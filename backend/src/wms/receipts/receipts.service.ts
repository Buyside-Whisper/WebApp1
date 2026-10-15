import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Product } from '../products/product.entity.js';
import { ProductStatus } from '../products/product-status.enum.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { formatDocumentNumber, nextDocumentNumber } from '../stock/document-number.js';
import { ProductWarehouse } from '../stock/product-warehouse.entity.js';
import { StockMovementKind } from '../stock/stock-movement-kind.enum.js';
import { StockService } from '../stock/stock.service.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { WarehouseStatus } from '../warehouses/warehouse-status.enum.js';
import { SaveReceiptDto } from './dto/receipt.dto.js';
import { Receipt } from './receipt.entity.js';
import { ReceiptLine } from './receipt-line.entity.js';
import { ReceiptStatus } from './receipt-status.enum.js';

const PREFIX = 'REC';
const round2 = (value: number) => Math.round(value * 100) / 100;

// What the API returns: the receipt plus its display number and totals; warehouse and products
// reduced to what the pages show.
export type ReceiptView = Omit<Receipt, 'warehouse' | 'lines'> & {
  code: string;
  lineCount: number;
  total: number;
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>;
  lines?: (Omit<ReceiptLine, 'product' | 'receipt'> & {
    product: Pick<Product, 'id' | 'name' | 'barcode' | 'unit'>;
  })[];
};

// Goods receipts (მიღება). A WMS admin works with every warehouse, a WMS manager only with the
// ones he runs; the system admin only looks. Posting adds the stock (through StockService) and
// updates each product's cost price to the weighted average.
@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<ReceiptView[]> {
    const scope = await this.warehouseScope(actor);
    const receipts = await this.receiptsRepository.find({
      where: { companyId: actor.companyId!, ...(scope ? { warehouseId: In([...scope]) } : {}) },
      relations: { warehouse: true, lines: true },
      order: { number: 'DESC' },
    });
    return receipts.map((receipt) => this.toView(receipt, false));
  }

  async findOne(actor: AuthUser, id: string): Promise<ReceiptView> {
    return this.toView(await this.load(actor, id), true);
  }

  async create(actor: AuthUser, dto: SaveReceiptDto): Promise<ReceiptView> {
    await this.checkWarehouse(actor, dto.warehouseId);
    const id = await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto);
      const receipt = manager.create(Receipt, {
        ...this.fields(dto),
        companyId: actor.companyId!,
        number: await nextDocumentNumber(manager, Receipt, actor.companyId!, 'receipt'),
        status: ReceiptStatus.DRAFT,
        createdByName: actor.displayName,
        lines: this.lines(actor, dto),
      });
      return (await manager.save(receipt)).id;
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'receipt.create', `Created draft receipt ${view.code} (${view.warehouse.code})`);
    return view;
  }

  // Only a draft can be changed; the lines are replaced as a whole.
  async update(actor: AuthUser, id: string, dto: SaveReceiptDto): Promise<ReceiptView> {
    const receipt = await this.load(actor, id);
    this.assertDraft(receipt);
    await this.checkWarehouse(actor, dto.warehouseId);
    await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto);
      await manager.delete(ReceiptLine, { receiptId: id, companyId: actor.companyId! });
      await manager.update(Receipt, { id, companyId: actor.companyId! }, this.fields(dto));
      await manager.save(
        ReceiptLine,
        this.lines(actor, dto).map((line) => ({ ...line, receiptId: id })),
      );
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'receipt.update', `Updated draft receipt ${view.code}`);
    return view;
  }

  // A draft can be thrown away; a posted receipt is cancelled instead (its history stays).
  async remove(actor: AuthUser, id: string): Promise<void> {
    const receipt = await this.load(actor, id);
    this.assertDraft(receipt);
    await this.checkWarehouse(actor, receipt.warehouseId);
    await this.receiptsRepository.delete({ id, companyId: actor.companyId! });
    await this.audit.record(actor, 'receipt.delete', `Deleted draft receipt ${this.code(receipt)}`);
  }

  async post(actor: AuthUser, id: string): Promise<ReceiptView> {
    await this.dataSource.transaction(async (manager) => {
      const receipt = await this.lockForChange(manager, actor, id);
      this.assertDraft(receipt);
      await this.checkWarehouse(actor, receipt.warehouseId, true);
      if (receipt.lines.length === 0) {
        throw new BadRequestException('Add at least one product before posting');
      }
      const products = await this.checkProducts(manager, actor, receipt);
      await this.updateAverageCosts(manager, actor, receipt.lines, products);
      await this.stockService.post(
        manager,
        actor,
        receipt.lines.map((line) => ({
          productId: line.productId,
          warehouseId: receipt.warehouseId,
          quantity: line.quantity,
        })),
        { kind: StockMovementKind.RECEIPT, documentId: receipt.id, note: this.code(receipt) },
      );
      await manager.update(Receipt, { id }, {
        status: ReceiptStatus.POSTED,
        postedByName: actor.displayName,
        postedAt: new Date(),
      });
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'receipt.post', `Posted receipt ${view.code}: ${view.lineCount} lines, ₾${view.total.toFixed(2)} into ${view.warehouse.code}`);
    return view;
  }

  // Takes the received goods back out. Fails (and changes nothing) when some of them have
  // already left the warehouse. Cost prices are left as they are.
  async cancel(actor: AuthUser, id: string): Promise<ReceiptView> {
    await this.dataSource.transaction(async (manager) => {
      const receipt = await this.lockForChange(manager, actor, id);
      if (receipt.status !== ReceiptStatus.POSTED) {
        throw new BadRequestException('Only a posted receipt can be cancelled');
      }
      await this.checkWarehouse(actor, receipt.warehouseId);
      await this.stockService.post(
        manager,
        actor,
        receipt.lines.map((line) => ({
          productId: line.productId,
          warehouseId: receipt.warehouseId,
          quantity: -line.quantity,
        })),
        { kind: StockMovementKind.RECEIPT_CANCEL, documentId: receipt.id, note: `Cancelled ${this.code(receipt)}` },
      );
      await manager.update(Receipt, { id }, {
        status: ReceiptStatus.CANCELLED,
        cancelledByName: actor.displayName,
        cancelledAt: new Date(),
      });
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'receipt.cancel', `Cancelled receipt ${view.code}`);
    return view;
  }

  // ---------- helpers ----------

  // New cost = (stock on hand × current cost + received × purchase price) / (on hand + received),
  // over all warehouses. With nothing on hand, the purchase price itself.
  private async updateAverageCosts(
    manager: EntityManager,
    actor: AuthUser,
    lines: ReceiptLine[],
    products: Map<string, Product>,
  ): Promise<void> {
    const onHand = await manager
      .createQueryBuilder(ProductWarehouse, 'pw')
      .select('pw.product_id', 'productId')
      .addSelect('SUM(pw.quantity)', 'quantity')
      .where({ companyId: actor.companyId!, productId: In([...products.keys()]) })
      .groupBy('pw.product_id')
      .getRawMany<{ productId: string; quantity: string }>();
    const quantities = new Map(onHand.map((row) => [row.productId, Math.max(0, Number(row.quantity))]));

    for (const product of products.values()) {
      let quantity = quantities.get(product.id) ?? 0;
      let value = quantity * product.costPrice;
      for (const line of lines.filter((l) => l.productId === product.id)) {
        quantity += line.quantity;
        value += line.quantity * line.unitCost;
      }
      const cost = quantity > 0 ? round2(value / quantity) : product.costPrice;
      if (cost !== product.costPrice) {
        await manager.update(Product, { id: product.id }, { costPrice: cost });
      }
    }
  }

  // Products must be the company's and active; pcs quantities whole.
  private async checkProducts(
    manager: EntityManager,
    actor: AuthUser,
    source: { lines: { productId: string; quantity: number }[] },
  ): Promise<Map<string, Product>> {
    const ids = [...new Set(source.lines.map((line) => line.productId))];
    const products = ids.length
      ? await manager.findBy(Product, { id: In(ids), companyId: actor.companyId! })
      : [];
    if (products.length !== ids.length) {
      throw new BadRequestException('One or more products do not exist');
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const line of source.lines) {
      const product = byId.get(line.productId)!;
      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`${product.name} is Not active`);
      }
      if (product.unit === ProductUnit.PCS && !Number.isInteger(line.quantity)) {
        throw new BadRequestException(`${product.name} is counted in pcs, so its quantity must be whole`);
      }
    }
    return byId;
  }

  // Only the WMS admin and the manager of the warehouse may change its receipts.
  private async checkWarehouse(actor: AuthUser, warehouseId: string, mustBeActive = false): Promise<void> {
    if (actor.role !== UserRole.MODULE_ADMIN && actor.role !== UserRole.MANAGER) {
      throw new NotFoundException('Receipt not found');
    }
    const warehouse = await this.dataSource.manager.findOneBy(Warehouse, { id: warehouseId, companyId: actor.companyId! });
    const scope = await this.warehouseScope(actor);
    if (!warehouse || (scope && !scope.has(warehouse.id))) {
      throw new BadRequestException('Pick one of your warehouses');
    }
    if (mustBeActive && warehouse.status !== WarehouseStatus.ACTIVE) {
      throw new BadRequestException(`${warehouse.code} is inactive`);
    }
  }

  // null = every warehouse (admins); otherwise the ones a manager runs.
  private async warehouseScope(actor: AuthUser): Promise<Set<string> | null> {
    return actor.role === UserRole.MANAGER ? this.stockService.managedWarehouseIds(actor) : null;
  }

  private async load(actor: AuthUser, id: string): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { warehouse: true, lines: { product: true } },
      order: { lines: { position: 'ASC' } },
    });
    const scope = receipt ? await this.warehouseScope(actor) : null;
    if (!receipt || (scope && !scope.has(receipt.warehouseId))) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    return receipt;
  }

  // Locks the receipt row so it can't be posted / cancelled twice at the same moment.
  private async lockForChange(manager: EntityManager, actor: AuthUser, id: string): Promise<Receipt> {
    const locked = await manager.findOne(Receipt, {
      where: { id, companyId: actor.companyId! },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    locked.lines = await manager.find(ReceiptLine, { where: { receiptId: id }, order: { position: 'ASC' } });
    const scope = await this.warehouseScope(actor);
    if (scope && !scope.has(locked.warehouseId)) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    return locked;
  }

  private assertDraft(receipt: Receipt): void {
    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(`${this.code(receipt)} is ${receipt.status}, so it can't be changed`);
    }
  }

  private fields(dto: SaveReceiptDto) {
    return {
      warehouseId: dto.warehouseId,
      supplier: dto.supplier,
      waybillNumber: dto.waybillNumber ?? null,
      date: dto.date,
      note: dto.note ?? null,
    };
  }

  private lines(actor: AuthUser, dto: SaveReceiptDto): Partial<ReceiptLine>[] {
    return dto.lines.map((line, position) => ({
      companyId: actor.companyId!,
      position,
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost,
    }));
  }

  private code(receipt: Pick<Receipt, 'number'>): string {
    return formatDocumentNumber(PREFIX, receipt.number);
  }

  private toView(receipt: Receipt, withLines: boolean): ReceiptView {
    const { warehouse, lines, ...rest } = receipt;
    return {
      ...rest,
      code: this.code(receipt),
      lineCount: lines.length,
      total: round2(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)),
      warehouse: { id: warehouse!.id, code: warehouse!.code, name: warehouse!.name },
      ...(withLines
        ? {
            lines: lines.map(({ product, receipt: _receipt, ...line }) => ({
              ...line,
              product: { id: product!.id, name: product!.name, barcode: product!.barcode, unit: product!.unit },
            })),
          }
        : {}),
    };
  }
}
