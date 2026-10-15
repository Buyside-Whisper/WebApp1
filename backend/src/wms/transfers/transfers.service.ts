import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Product } from '../products/product.entity.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { formatDocumentNumber, nextDocumentNumber } from '../stock/document-number.js';
import { StockMovementKind } from '../stock/stock-movement-kind.enum.js';
import { StockService } from '../stock/stock.service.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { WarehouseStatus } from '../warehouses/warehouse-status.enum.js';
import { ReceiveTransferDto, SaveTransferDto } from './dto/transfer.dto.js';
import { Transfer } from './transfer.entity.js';
import { TransferLine } from './transfer-line.entity.js';
import { TransferStatus } from './transfer-status.enum.js';

const PREFIX = 'TR';
const round3 = (value: number) => Math.round(value * 1000) / 1000;

type WarehouseRef = Pick<Warehouse, 'id' | 'code' | 'name'>;

export type TransferView = Omit<Transfer, 'fromWarehouse' | 'toWarehouse' | 'lines'> & {
  code: string;
  lineCount: number;
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  lines?: (Omit<TransferLine, 'product' | 'transfer'> & {
    product: Pick<Product, 'id' | 'name' | 'barcode' | 'unit'>;
  })[];
};

// Which side of a transfer the current user may act for.
type Side = 'from' | 'to';

// Transfers (გადაადგილება) between two of the company's warehouses. The WMS admin works with all
// of them. A WMS manager sees the transfers that touch his warehouses; he prepares, sends and
// cancels the ones leaving his warehouse, and receives the ones coming into it. The system admin
// only reads.
@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transfersRepository: Repository<Transfer>,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<TransferView[]> {
    const scope = await this.scope(actor);
    const company = { companyId: actor.companyId! };
    const transfers = await this.transfersRepository.find({
      where: scope
        ? [
            { ...company, fromWarehouseId: In([...scope]) },
            { ...company, toWarehouseId: In([...scope]) },
          ]
        : company,
      relations: { fromWarehouse: true, toWarehouse: true, lines: true },
      order: { number: 'DESC' },
    });
    return transfers.map((transfer) => this.toView(transfer, false));
  }

  async findOne(actor: AuthUser, id: string): Promise<TransferView> {
    return this.toView(await this.load(actor, id), true);
  }

  async create(actor: AuthUser, dto: SaveTransferDto): Promise<TransferView> {
    await this.checkWarehouses(actor, dto);
    const id = await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto.lines);
      const transfer = manager.create(Transfer, {
        ...this.fields(dto),
        companyId: actor.companyId!,
        number: await nextDocumentNumber(manager, Transfer, actor.companyId!, 'transfer'),
        status: TransferStatus.DRAFT,
        createdByName: actor.displayName,
        lines: this.lines(actor, dto),
      });
      return (await manager.save(transfer)).id;
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'transfer.create', `Created draft transfer ${view.code} (${view.fromWarehouse.code} → ${view.toWarehouse.code})`);
    return view;
  }

  async update(actor: AuthUser, id: string, dto: SaveTransferDto): Promise<TransferView> {
    const transfer = await this.load(actor, id);
    this.assertStatus(transfer, TransferStatus.DRAFT);
    await this.assertSide(actor, transfer, 'from');
    await this.checkWarehouses(actor, dto);
    await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(manager, actor, dto.lines);
      await manager.delete(TransferLine, { transferId: id, companyId: actor.companyId! });
      await manager.update(Transfer, { id, companyId: actor.companyId! }, this.fields(dto));
      await manager.save(
        TransferLine,
        this.lines(actor, dto).map((line) => ({ ...line, transferId: id })),
      );
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'transfer.update', `Updated draft transfer ${view.code}`);
    return view;
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const transfer = await this.load(actor, id);
    this.assertStatus(transfer, TransferStatus.DRAFT);
    await this.assertSide(actor, transfer, 'from');
    await this.transfersRepository.delete({ id, companyId: actor.companyId! });
    await this.audit.record(actor, 'transfer.delete', `Deleted draft transfer ${this.code(transfer)}`);
  }

  // Step 1: the goods leave the source warehouse (fails if it doesn't have enough).
  async send(actor: AuthUser, id: string): Promise<TransferView> {
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockForChange(manager, actor, id);
      this.assertStatus(transfer, TransferStatus.DRAFT);
      await this.assertSide(actor, transfer, 'from');
      if (transfer.lines.length === 0) {
        throw new BadRequestException('Add at least one product before sending');
      }
      await this.checkWarehouses(actor, transfer, true);
      await this.stockService.post(
        manager,
        actor,
        transfer.lines.map((line) => ({
          productId: line.productId,
          warehouseId: transfer.fromWarehouseId,
          quantity: -line.quantity,
        })),
        { kind: StockMovementKind.TRANSFER_OUT, documentId: transfer.id, note: this.code(transfer) },
      );
      await manager.update(Transfer, { id }, {
        status: TransferStatus.IN_TRANSIT,
        sentByName: actor.displayName,
        sentAt: new Date(),
      });
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'transfer.send', `Sent transfer ${view.code} (${view.fromWarehouse.code} → ${view.toWarehouse.code})`);
    return view;
  }

  // Step 2: the destination confirms what arrived (at most what was sent); that goes into its
  // stock. A shortfall stays visible on the transfer.
  async receive(actor: AuthUser, id: string, dto: ReceiveTransferDto): Promise<TransferView> {
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockForChange(manager, actor, id);
      this.assertStatus(transfer, TransferStatus.IN_TRANSIT);
      await this.assertSide(actor, transfer, 'to');

      const given = new Map(dto.lines.map((line) => [line.lineId, line.receivedQuantity]));
      for (const lineId of given.keys()) {
        if (!transfer.lines.some((line) => line.id === lineId)) {
          throw new BadRequestException('A received line is not on this transfer');
        }
      }
      const products = await manager.findBy(Product, {
        id: In(transfer.lines.map((line) => line.productId)),
        companyId: actor.companyId!,
      });
      for (const line of transfer.lines) {
        const received = given.get(line.id) ?? line.quantity;
        const product = products.find((p) => p.id === line.productId)!;
        if (received > line.quantity) {
          throw new BadRequestException(`More ${product.name} received than was sent (${line.quantity})`);
        }
        if (product.unit === ProductUnit.PCS && !Number.isInteger(received)) {
          throw new BadRequestException(`${product.name} is counted in pcs, so its quantity must be whole`);
        }
        line.receivedQuantity = received;
        await manager.update(TransferLine, { id: line.id }, { receivedQuantity: received });
      }

      await this.stockService.post(
        manager,
        actor,
        transfer.lines.map((line) => ({
          productId: line.productId,
          warehouseId: transfer.toWarehouseId,
          quantity: line.receivedQuantity!,
        })),
        { kind: StockMovementKind.TRANSFER_IN, documentId: transfer.id, note: this.code(transfer) },
      );
      await manager.update(Transfer, { id }, {
        status: TransferStatus.RECEIVED,
        receivedByName: actor.displayName,
        receivedAt: new Date(),
      });
    });
    const view = await this.findOne(actor, id);
    const missing = view.lines!.filter((line) => line.receivedQuantity! < line.quantity).length;
    await this.audit.record(
      actor,
      'transfer.receive',
      `Received transfer ${view.code} into ${view.toWarehouse.code}${missing ? ` (${missing} lines short)` : ''}`,
    );
    return view;
  }

  // Calls off a transfer in transit: the goods go back into the source warehouse. A received
  // transfer is final; send the goods back with a new transfer instead.
  async cancel(actor: AuthUser, id: string): Promise<TransferView> {
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockForChange(manager, actor, id);
      this.assertStatus(transfer, TransferStatus.IN_TRANSIT);
      await this.assertSide(actor, transfer, 'from');
      await this.stockService.post(
        manager,
        actor,
        transfer.lines.map((line) => ({
          productId: line.productId,
          warehouseId: transfer.fromWarehouseId,
          quantity: line.quantity,
        })),
        { kind: StockMovementKind.TRANSFER_CANCEL, documentId: transfer.id, note: `Cancelled ${this.code(transfer)}` },
      );
      await manager.update(Transfer, { id }, {
        status: TransferStatus.CANCELLED,
        cancelledByName: actor.displayName,
        cancelledAt: new Date(),
      });
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(actor, 'transfer.cancel', `Cancelled transfer ${view.code}`);
    return view;
  }

  // ---------- helpers ----------

  // Two different warehouses of the company; a manager must run the source one.
  private async checkWarehouses(
    actor: AuthUser,
    source: { fromWarehouseId: string; toWarehouseId: string },
    mustBeActive = false,
  ): Promise<void> {
    if (source.fromWarehouseId === source.toWarehouseId) {
      throw new BadRequestException('Pick two different warehouses');
    }
    const warehouses = await this.dataSource.manager.findBy(Warehouse, {
      id: In([source.fromWarehouseId, source.toWarehouseId]),
      companyId: actor.companyId!,
    });
    if (warehouses.length !== 2) {
      throw new BadRequestException('One or both warehouses do not exist');
    }
    const scope = await this.scope(actor);
    if (scope && !scope.has(source.fromWarehouseId)) {
      throw new BadRequestException('You can only send goods from a warehouse you run');
    }
    if (mustBeActive) {
      const inactive = warehouses.find((warehouse) => warehouse.status !== WarehouseStatus.ACTIVE);
      if (inactive) {
        throw new BadRequestException(`${inactive.code} is inactive`);
      }
    }
  }

  // Products must be the company's; pcs quantities whole. (Not-active products may still be moved.)
  private async checkProducts(
    manager: EntityManager,
    actor: AuthUser,
    lines: { productId: string; quantity: number }[],
  ): Promise<void> {
    const ids = [...new Set(lines.map((line) => line.productId))];
    if (ids.length !== lines.length) {
      throw new BadRequestException('A product is listed more than once');
    }
    const products = ids.length ? await manager.findBy(Product, { id: In(ids), companyId: actor.companyId! }) : [];
    if (products.length !== ids.length) {
      throw new BadRequestException('One or more products do not exist');
    }
    for (const line of lines) {
      const product = products.find((p) => p.id === line.productId)!;
      if (product.unit === ProductUnit.PCS && !Number.isInteger(line.quantity)) {
        throw new BadRequestException(`${product.name} is counted in pcs, so its quantity must be whole`);
      }
    }
  }

  // The system admin only reads; a manager acts for the side(s) he runs.
  private async assertSide(actor: AuthUser, transfer: Transfer, side: Side): Promise<void> {
    if (actor.role !== UserRole.MODULE_ADMIN && actor.role !== UserRole.MANAGER) {
      throw new NotFoundException('Transfer not found');
    }
    const scope = await this.scope(actor);
    const warehouseId = side === 'from' ? transfer.fromWarehouseId : transfer.toWarehouseId;
    if (scope && !scope.has(warehouseId)) {
      throw new BadRequestException(
        side === 'from'
          ? 'Only the manager of the sending warehouse (or the WMS admin) can do this'
          : 'Only the manager of the receiving warehouse (or the WMS admin) can receive it',
      );
    }
  }

  // null = every warehouse (admins); otherwise the ones a manager runs.
  private async scope(actor: AuthUser): Promise<Set<string> | null> {
    return actor.role === UserRole.MANAGER ? this.stockService.managedWarehouseIds(actor) : null;
  }

  private async load(actor: AuthUser, id: string): Promise<Transfer> {
    const transfer = await this.transfersRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { fromWarehouse: true, toWarehouse: true, lines: { product: true } },
      order: { lines: { position: 'ASC' } },
    });
    const scope = transfer ? await this.scope(actor) : null;
    if (!transfer || (scope && !scope.has(transfer.fromWarehouseId) && !scope.has(transfer.toWarehouseId))) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }
    return transfer;
  }

  private async lockForChange(manager: EntityManager, actor: AuthUser, id: string): Promise<Transfer> {
    const locked = await manager.findOne(Transfer, {
      where: { id, companyId: actor.companyId! },
      lock: { mode: 'pessimistic_write' },
    });
    const scope = locked ? await this.scope(actor) : null;
    if (!locked || (scope && !scope.has(locked.fromWarehouseId) && !scope.has(locked.toWarehouseId))) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }
    locked.lines = await manager.find(TransferLine, { where: { transferId: id }, order: { position: 'ASC' } });
    return locked;
  }

  private assertStatus(transfer: Transfer, expected: TransferStatus): void {
    if (transfer.status !== expected) {
      const what = { draft: 'a draft', in_transit: 'in transit', received: 'received', cancelled: 'cancelled' };
      throw new BadRequestException(`${this.code(transfer)} is ${what[transfer.status]}, so that can't be done`);
    }
  }

  private fields(dto: SaveTransferDto) {
    return {
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      date: dto.date,
      note: dto.note ?? null,
    };
  }

  private lines(actor: AuthUser, dto: SaveTransferDto): Partial<TransferLine>[] {
    return dto.lines.map((line, position) => ({
      companyId: actor.companyId!,
      position,
      productId: line.productId,
      quantity: round3(line.quantity),
    }));
  }

  private code(transfer: Pick<Transfer, 'number'>): string {
    return formatDocumentNumber(PREFIX, transfer.number);
  }

  private toView(transfer: Transfer, withLines: boolean): TransferView {
    const { fromWarehouse, toWarehouse, lines, ...rest } = transfer;
    const ref = (w: Warehouse | undefined) => ({ id: w!.id, code: w!.code, name: w!.name });
    return {
      ...rest,
      code: this.code(transfer),
      lineCount: lines.length,
      fromWarehouse: ref(fromWarehouse),
      toWarehouse: ref(toWarehouse),
      ...(withLines
        ? {
            lines: lines.map(({ product, transfer: _transfer, ...line }) => ({
              ...line,
              product: { id: product!.id, name: product!.name, barcode: product!.barcode, unit: product!.unit },
            })),
          }
        : {}),
    };
  }
}
