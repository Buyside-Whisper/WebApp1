import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { nameKey } from '../../common/name-key.js';
import { RsClient, RsWaybillDetail } from '../../rs/waybills/rs-client.js';
import { RsWaybillsService } from '../../rs/waybills/waybills.service.js';
import { Product } from '../products/product.entity.js';
import { ProductStatus } from '../products/product-status.enum.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { formatDocumentNumber, nextDocumentNumber } from '../stock/document-number.js';
import { ProductWarehouse } from '../stock/product-warehouse.entity.js';
import { StockMovementKind } from '../stock/stock-movement-kind.enum.js';
import { matchRsProducts, rememberRsProducts, rsUnitProblem } from '../stock/rs-matching.js';
import { StockService } from '../stock/stock.service.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { SupplierStatus } from '../suppliers/supplier-status.enum.js';
import { SupplierType } from '../suppliers/supplier-type.enum.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { WarehouseStatus } from '../warehouses/warehouse-status.enum.js';
import { CreateReceiptFromRsDto, SaveReceiptDto } from './dto/receipt.dto.js';
import { Receipt } from './receipt.entity.js';
import { ReceiptLine } from './receipt-line.entity.js';
import { ReceiptStatus } from './receipt-status.enum.js';

const PREFIX = 'REC';
const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const RS_PURCHASE_TYPES = new Set([2, 3, 4, 6]);
const RS_RECEIVABLE_STATUSES = new Set([1, 2]);

export type ReceiptView = Omit<Receipt, 'warehouse' | 'lines' | 'supplier'> & {
  code: string;
  lineCount: number;
  total: number;
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>;
  supplier: Pick<Supplier, 'id' | 'name' | 'identificationCode' | 'status'>;
  lines?: (Omit<ReceiptLine, 'product' | 'receipt'> & {
    product: Pick<Product, 'id' | 'name' | 'barcode' | 'unit'> | null;
  })[];
};

export interface RsReceiptLink {
  rsWaybillId: string;
  receiptId: string;
  code: string;
  status: ReceiptStatus;
}

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
    private readonly stockService: StockService,
    private readonly suppliersService: SuppliersService,
    private readonly rsWaybills: RsWaybillsService,
    private readonly rsClient: RsClient,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<ReceiptView[]> {
    const scope = await this.warehouseScope(actor);
    const receipts = await this.receiptsRepository.find({
      where: { companyId: actor.companyId!, ...(scope ? { warehouseId: In([...scope]) } : {}) },
      relations: { warehouse: true, lines: true, supplier: true },
      order: { number: 'DESC' },
    });
    return receipts.map((receipt) => this.toView(receipt, false));
  }

  async findOne(actor: AuthUser, id: string): Promise<ReceiptView> {
    return this.toView(await this.load(actor, id), true);
  }

  async rsLinks(actor: AuthUser): Promise<RsReceiptLink[]> {
    const receipts = await this.receiptsRepository.find({
      select: { id: true, number: true, status: true, rsWaybillId: true },
      where: { companyId: actor.companyId!, rsWaybillId: Not(IsNull()), status: Not(ReceiptStatus.CANCELLED) },
    });
    return receipts.map((r) => ({ rsWaybillId: r.rsWaybillId!, receiptId: r.id, code: this.code(r), status: r.status }));
  }

  async create(actor: AuthUser, dto: SaveReceiptDto): Promise<ReceiptView> {
    await this.checkWarehouse(actor, dto.warehouseId);
    await this.checkSupplier(actor, dto.supplierId, true);
    this.requireProducts(dto.lines);
    const id = await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto, false);
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

  async createFromRs(actor: AuthUser, waybillId: string, dto: CreateReceiptFromRsDto): Promise<ReceiptView> {
    if (actor.role !== UserRole.MODULE_ADMIN) {
      throw new BadRequestException('Only the WMS admin creates receipts from RS waybills');
    }
    await this.checkWarehouse(actor, dto.warehouseId, true);
    const existing = await this.activeReceiptFor(actor, waybillId);
    if (existing) {
      throw new ConflictException({
        message: `This waybill already has receipt ${this.code(existing)}`,
        receiptId: existing.id,
      });
    }

    const waybill = await this.rsClient.waybill(await this.rsWaybills.companyCredentials(actor), waybillId);
    this.assertReceivable(waybill);
    const supplier = await this.supplierFor(actor, waybill, dto.createSupplier === true);
    const products = await matchRsProducts(this.dataSource, actor.companyId!, supplier.identificationCode ?? waybill.sellerTin ?? '', waybill.goods);

    const id = await this.dataSource.transaction(async (manager) => {
      const receipt = manager.create(Receipt, {
        companyId: actor.companyId!,
        number: await nextDocumentNumber(manager, Receipt, actor.companyId!, 'receipt'),
        status: ReceiptStatus.DRAFT,
        warehouseId: dto.warehouseId,
        supplierId: supplier.id,
        waybillNumber: waybill.number,
        rsWaybillId: waybill.id,
        rsConfirmedAt: waybill.confirmation === 'accepted' ? new Date() : null,
        date: (waybill.activatedAt ?? waybill.createdAt ?? new Date().toISOString()).slice(0, 10),
        note: waybill.comment,
        createdByName: actor.displayName,
        lines: waybill.goods.map((goods, position) => ({
          companyId: actor.companyId!,
          position,
          productId: products[position]?.id ?? null,
          quantity: round3(goods.quantity),
          unitCost: round2(goods.price),
          rsName: goods.name,
          rsBarcode: goods.barcode,
          rsUnitId: goods.unitId,
          rsUnit: goods.unitName,
        })),
      });
      return (await manager.save(receipt)).id;
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(
      actor,
      'receipt.create_from_rs',
      `Created draft receipt ${view.code} from RS waybill ${waybill.number} (${waybill.sellerName ?? waybill.sellerTin})`,
    );
    return view;
  }

  async rejectRs(actor: AuthUser, waybillId: string): Promise<void> {
    if (actor.role !== UserRole.MODULE_ADMIN) {
      throw new BadRequestException('Only the WMS admin rejects RS waybills');
    }
    const existing = await this.activeReceiptFor(actor, waybillId);
    if (existing && existing.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `The goods were already received with ${this.code(existing)}. Cancel that receipt first if they really were not delivered.`,
      );
    }
    const credentials = await this.rsWaybills.companyCredentials(actor);
    const waybill = await this.rsClient.waybill(credentials, waybillId);
    if (waybill.confirmation === 'rejected') {
      throw new BadRequestException(`Waybill ${waybill.number} is already rejected in RS`);
    }
    if (!(await this.rsClient.rejectWaybill(credentials, waybillId))) {
      throw new BadRequestException(`RS did not reject waybill ${waybill.number}. Nothing was changed.`);
    }
    this.rsWaybills.forgetLists(actor);
    if (existing) {
      await this.receiptsRepository.delete({ id: existing.id, companyId: actor.companyId! });
    }
    await this.audit.record(
      actor,
      'rs.reject',
      `Rejected RS waybill ${waybill.number} from ${waybill.sellerName ?? waybill.sellerTin}${existing ? ` and deleted draft ${this.code(existing)}` : ''}`,
    );
  }

  async update(actor: AuthUser, id: string, dto: SaveReceiptDto): Promise<ReceiptView> {
    const receipt = await this.load(actor, id);
    this.assertDraft(receipt);
    await this.checkWarehouse(actor, dto.warehouseId);
    if (receipt.rsWaybillId) {
      return this.updateFromRsDraft(actor, receipt, dto);
    }
    await this.checkSupplier(actor, dto.supplierId, dto.supplierId !== receipt.supplierId);
    this.requireProducts(dto.lines);
    await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto, false);
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

  async remove(actor: AuthUser, id: string): Promise<void> {
    const receipt = await this.load(actor, id);
    this.assertDraft(receipt);
    await this.checkWarehouse(actor, receipt.warehouseId);
    await this.receiptsRepository.delete({ id, companyId: actor.companyId! });
    await this.audit.record(actor, 'receipt.delete', `Deleted draft receipt ${this.code(receipt)}`);
  }

  async post(actor: AuthUser, id: string): Promise<ReceiptView> {
    const draft = await this.load(actor, id);
    this.assertDraft(draft);
    if (draft.rsWaybillId) {
      await this.confirmInRs(actor, draft);
    }
    await this.dataSource.transaction(async (manager) => {
      const receipt = await this.lockForChange(manager, actor, id);
      this.assertDraft(receipt);
      await this.checkWarehouse(actor, receipt.warehouseId, true);
      if (receipt.lines.length === 0) {
        throw new BadRequestException('Add at least one product before posting');
      }
      const products = await this.checkProducts(manager, actor, receipt, true);
      await this.updateAverageCosts(manager, actor, receipt.lines, products);
      await this.stockService.post(
        manager,
        actor,
        receipt.lines.map((line) => ({
          productId: line.productId!,
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
          productId: line.productId!,
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

  private async updateFromRsDraft(actor: AuthUser, receipt: Receipt, dto: SaveReceiptDto): Promise<ReceiptView> {
    if (dto.lines.length !== receipt.lines.length) {
      throw new BadRequestException("A receipt from an RS waybill keeps the waybill's lines; only their products can change");
    }
    const productIds = dto.lines.map((line) => line.productId ?? null);
    await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(
        manager,
        actor,
        { lines: receipt.lines.map((line, i) => ({ productId: productIds[i], quantity: line.quantity })) },
        false,
      );
      await manager.update(
        Receipt,
        { id: receipt.id, companyId: actor.companyId! },
        { warehouseId: dto.warehouseId, note: dto.note ?? null },
      );
      for (const [i, line] of receipt.lines.entries()) {
        if (line.productId !== productIds[i]) {
          await manager.update(ReceiptLine, { id: line.id }, { productId: productIds[i] });
        }
      }
      await rememberRsProducts(manager, actor.companyId!, receipt.supplier?.identificationCode, receipt.lines, productIds);
    });
    const view = await this.findOne(actor, receipt.id);
    await this.audit.record(actor, 'receipt.update', `Updated draft receipt ${view.code} (from RS)`);
    return view;
  }

  private async confirmInRs(actor: AuthUser, receipt: Receipt): Promise<void> {
    const unmatched = receipt.lines.filter((line) => !line.productId);
    if (unmatched.length) {
      throw new BadRequestException(
        `Link every line to a product first (${unmatched.map((line) => line.rsName).join(', ')})`,
      );
    }
    for (const line of receipt.lines) {
      const problem = rsUnitProblem(line, line.product);
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    if (receipt.rsConfirmedAt) {
      return;
    }
    const credentials = await this.rsWaybills.companyCredentials(actor);
    const waybill = await this.rsClient.waybill(credentials, receipt.rsWaybillId!);
    this.assertReceivable(waybill);
    const changed =
      waybill.goods.length !== receipt.lines.length ||
      waybill.goods.some((goods, i) => {
        const line = receipt.lines[i];
        return round3(goods.quantity) !== line.quantity || round2(goods.price) !== line.unitCost || goods.name !== line.rsName;
      });
    if (changed) {
      throw new BadRequestException(
        `Waybill ${waybill.number} was changed in RS after this receipt was made. Delete this draft and create the receipt again.`,
      );
    }
    if (waybill.confirmation !== 'accepted') {
      if (!(await this.rsClient.confirmWaybill(credentials, waybill.id))) {
        throw new BadRequestException(`RS did not confirm waybill ${waybill.number}. Nothing was posted.`);
      }
    }
    await this.receiptsRepository.update({ id: receipt.id }, { rsConfirmedAt: new Date() });
    receipt.rsConfirmedAt = new Date();
    this.rsWaybills.forgetLists(actor);
    await this.audit.record(actor, 'rs.confirm', `Confirmed RS waybill ${waybill.number} for ${this.code(receipt)}`);
  }

  private assertReceivable(waybill: RsWaybillDetail): void {
    if (waybill.typeId === null || !RS_PURCHASE_TYPES.has(waybill.typeId)) {
      throw new BadRequestException(
        `Waybill ${waybill.number} is ${waybill.typeName ?? 'of another type'}, not a purchase, so it doesn't become a receipt`,
      );
    }
    if (waybill.status === null || !RS_RECEIVABLE_STATUSES.has(waybill.status)) {
      throw new BadRequestException(`Waybill ${waybill.number} is not active in RS (it was saved only, deleted or cancelled)`);
    }
    if (waybill.confirmation === 'rejected') {
      throw new BadRequestException(`Waybill ${waybill.number} was rejected in RS`);
    }
    if (waybill.goods.length === 0) {
      throw new BadRequestException(`Waybill ${waybill.number} has no goods lines`);
    }
  }

  private async supplierFor(actor: AuthUser, waybill: RsWaybillDetail, create: boolean): Promise<Supplier> {
    const tin = waybill.sellerTin?.trim() ?? '';
    const suppliers = this.dataSource.getRepository(Supplier);
    const byCode = tin ? await suppliers.findOneBy({ companyId: actor.companyId!, identificationCode: tin }) : null;
    if (byCode) {
      if (byCode.status !== SupplierStatus.ACTIVE) {
        throw new BadRequestException(`The supplier ${byCode.name} (${tin}) is inactive. Reactivate it in Products → Suppliers first.`);
      }
      return byCode;
    }
    const name = waybill.sellerName?.trim() || tin;
    const byName = (await suppliers.findBy({ companyId: actor.companyId! })).find(
      (supplier) => nameKey(supplier.name) === nameKey(name),
    );
    if (!create) {
      throw new ConflictException({
        message: byName
          ? `${byName.name} is in your Suppliers without identification code ${tin}.`
          : `The seller ${name} (${tin}) is not in your Suppliers yet.`,
        code: 'SUPPLIER_MISSING',
        seller: { name, identificationCode: tin, existingSupplier: byName?.name ?? null },
      });
    }
    const type = tin.length === 11 ? SupplierType.INDIVIDUAL : SupplierType.COMPANY;
    if (byName && !byName.identificationCode) {
      await this.suppliersService.update(actor, byName.id, { identificationCode: tin || null, type });
      return (await suppliers.findOneBy({ id: byName.id }))!;
    }
    const created = await this.suppliersService.create(actor, {
      name: byName ? `${name} (${tin})` : name,
      type,
      identificationCode: /^(\d{9}|\d{11})$/.test(tin) ? tin : null,
    });
    return (await suppliers.findOneBy({ id: created.id }))!;
  }

  private activeReceiptFor(actor: AuthUser, waybillId: string): Promise<Receipt | null> {
    return this.receiptsRepository.findOneBy({
      companyId: actor.companyId!,
      rsWaybillId: waybillId,
      status: Not(ReceiptStatus.CANCELLED),
    });
  }

  private async checkSupplier(actor: AuthUser, supplierId: string, mustBeActive: boolean): Promise<void> {
    const supplier = await this.dataSource.getRepository(Supplier).findOneBy({ id: supplierId, companyId: actor.companyId! });
    if (!supplier) {
      throw new BadRequestException('Choose a supplier from the list');
    }
    if (mustBeActive && supplier.status !== SupplierStatus.ACTIVE) {
      throw new BadRequestException(`The supplier ${supplier.name} is inactive`);
    }
  }

  private requireProducts(lines: { productId: string | null }[]): void {
    if (lines.some((line) => !line.productId)) {
      throw new BadRequestException('Every line needs a product');
    }
  }

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

  private async checkProducts(
    manager: EntityManager,
    actor: AuthUser,
    source: { lines: { productId: string | null; quantity: number }[] },
    requireAll: boolean,
  ): Promise<Map<string, Product>> {
    if (requireAll) {
      this.requireProducts(source.lines);
    }
    const ids = [...new Set(source.lines.flatMap((line) => (line.productId ? [line.productId] : [])))];
    const products = ids.length
      ? await manager.findBy(Product, { id: In(ids), companyId: actor.companyId! })
      : [];
    if (products.length !== ids.length) {
      throw new BadRequestException('One or more products do not exist');
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const line of source.lines) {
      if (!line.productId) {
        continue;
      }
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

  private async warehouseScope(actor: AuthUser): Promise<Set<string> | null> {
    return actor.role === UserRole.MANAGER ? this.stockService.managedWarehouseIds(actor) : null;
  }

  private async load(actor: AuthUser, id: string): Promise<Receipt> {
    const receipt = await this.receiptsRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { warehouse: true, supplier: true, lines: { product: true } },
      order: { lines: { position: 'ASC' } },
    });
    const scope = receipt ? await this.warehouseScope(actor) : null;
    if (!receipt || (scope && !scope.has(receipt.warehouseId))) {
      throw new NotFoundException(`Receipt ${id} not found`);
    }
    return receipt;
  }

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
      supplierId: dto.supplierId,
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
    const { warehouse, lines, supplier, ...rest } = receipt;
    return {
      ...rest,
      code: this.code(receipt),
      lineCount: lines.length,
      total: round2(lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)),
      warehouse: { id: warehouse!.id, code: warehouse!.code, name: warehouse!.name },
      supplier: {
        id: supplier?.id ?? receipt.supplierId,
        name: supplier?.name ?? '',
        identificationCode: supplier?.identificationCode ?? null,
        status: supplier?.status ?? SupplierStatus.ACTIVE,
      },
      ...(withLines
        ? {
            lines: lines.map(({ product, receipt: _receipt, ...line }) => ({
              ...line,
              product: product
                ? { id: product.id, name: product.name, barcode: product.barcode, unit: product.unit }
                : null,
            })),
          }
        : {}),
    };
  }
}
