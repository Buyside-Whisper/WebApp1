import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { RsClient, RsWaybillDetail } from '../../rs/waybills/rs-client.js';
import { RsWaybillsService } from '../../rs/waybills/waybills.service.js';
import { Product } from '../products/product.entity.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { formatDocumentNumber, nextDocumentNumber } from '../stock/document-number.js';
import { StockMovementKind } from '../stock/stock-movement-kind.enum.js';
import { matchRsProducts, rememberRsProducts, rsUnitProblem } from '../stock/rs-matching.js';
import { StockService } from '../stock/stock.service.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { WarehouseStatus } from '../warehouses/warehouse-status.enum.js';
import { CreateTransferFromRsDto, ReceiveTransferDto, SaveTransferDto } from './dto/transfer.dto.js';
import { Transfer } from './transfer.entity.js';
import { TransferLine } from './transfer-line.entity.js';
import { TransferStatus } from './transfer-status.enum.js';

const PREFIX = 'TR';
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const RS_INTERNAL_TYPE = 1;
const RS_ACTIVE = 1;
const RS_CLOSED = 2;

export interface RsTransferLink {
  rsWaybillId: string;
  transferId: string;
  code: string;
  status: TransferStatus;
}

type WarehouseRef = Pick<Warehouse, 'id' | 'code' | 'name'>;

export type TransferView = Omit<Transfer, 'fromWarehouse' | 'toWarehouse' | 'lines'> & {
  code: string;
  lineCount: number;
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  lines?: (Omit<TransferLine, 'product' | 'transfer'> & {
    product: Pick<Product, 'id' | 'name' | 'barcode' | 'unit'> | null;
  })[];
};

type Side = 'from' | 'to';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transfersRepository: Repository<Transfer>,
    private readonly stockService: StockService,
    private readonly rsWaybills: RsWaybillsService,
    private readonly rsClient: RsClient,
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

  async rsLinks(actor: AuthUser): Promise<RsTransferLink[]> {
    const transfers = await this.transfersRepository.find({
      select: { id: true, number: true, status: true, rsWaybillId: true },
      where: { companyId: actor.companyId!, rsWaybillId: Not(IsNull()), status: Not(TransferStatus.CANCELLED) },
    });
    return transfers.map((t) => ({ rsWaybillId: t.rsWaybillId!, transferId: t.id, code: this.code(t), status: t.status }));
  }

  async createFromRs(actor: AuthUser, waybillId: string, dto: CreateTransferFromRsDto): Promise<TransferView> {
    if (actor.role !== UserRole.MODULE_ADMIN) {
      throw new BadRequestException('Only the WMS admin creates transfers from RS waybills');
    }
    await this.checkWarehouses(actor, dto, true);
    const existing = await this.transfersRepository.findOneBy({
      companyId: actor.companyId!,
      rsWaybillId: waybillId,
      status: Not(TransferStatus.CANCELLED),
    });
    if (existing) {
      throw new ConflictException({ message: `This waybill already has transfer ${this.code(existing)}`, transferId: existing.id });
    }
    const waybill = await this.rsClient.waybill(await this.rsWaybills.companyCredentials(actor), waybillId);
    this.assertInternal(waybill);
    const products = await matchRsProducts(this.dataSource, actor.companyId!, waybill.sellerTin ?? '', waybill.goods);

    const id = await this.dataSource.transaction(async (manager) => {
      const transfer = manager.create(Transfer, {
        companyId: actor.companyId!,
        number: await nextDocumentNumber(manager, Transfer, actor.companyId!, 'transfer'),
        status: TransferStatus.DRAFT,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        date: (waybill.activatedAt ?? waybill.createdAt ?? new Date().toISOString()).slice(0, 10),
        note: waybill.comment,
        rsWaybillId: waybill.id,
        waybillNumber: waybill.number,
        rsSellerTin: waybill.sellerTin,
        rsClosedAt: waybill.status === RS_CLOSED ? new Date() : null,
        createdByName: actor.displayName,
        lines: waybill.goods.map((goods, position) => ({
          companyId: actor.companyId!,
          position,
          productId: products[position]?.id ?? null,
          quantity: round3(goods.quantity),
          rsName: goods.name,
          rsBarcode: goods.barcode,
          rsUnitId: goods.unitId,
          rsUnit: goods.unitName,
        })),
      });
      return (await manager.save(transfer)).id;
    });
    const view = await this.findOne(actor, id);
    await this.audit.record(
      actor,
      'transfer.create_from_rs',
      `Created draft transfer ${view.code} from RS waybill ${waybill.number} (${view.fromWarehouse.code} → ${view.toWarehouse.code})`,
    );
    return view;
  }

  async create(actor: AuthUser, dto: SaveTransferDto): Promise<TransferView> {
    this.requireProducts(dto.lines);
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
    if (transfer.rsWaybillId) {
      return this.updateFromRsDraft(actor, transfer, dto);
    }
    this.requireProducts(dto.lines);
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

  async send(actor: AuthUser, id: string): Promise<TransferView> {
    const draft = await this.load(actor, id);
    if (draft.rsWaybillId && draft.status === TransferStatus.DRAFT) {
      await this.checkRsBeforeSend(actor, draft);
    }
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
          productId: line.productId!,
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

  async receive(actor: AuthUser, id: string, dto: ReceiveTransferDto): Promise<TransferView> {
    const sent = await this.load(actor, id);
    if (sent.rsWaybillId && sent.status === TransferStatus.IN_TRANSIT) {
      await this.assertSide(actor, sent, 'to');
      const short = dto.lines.find((given) => {
        const line = sent.lines.find((l) => l.id === given.lineId);
        return line && given.receivedQuantity !== line.quantity;
      });
      if (short) {
        throw new BadRequestException(
          'A transfer from an RS waybill is received in full: the waybill fixes the quantities. If something is missing, correct the waybill in RS first.',
        );
      }
      await this.closeInRs(actor, sent);
    }
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
        id: In(transfer.lines.map((line) => line.productId!)),
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
          productId: line.productId!,
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

  async cancel(actor: AuthUser, id: string): Promise<TransferView> {
    const current = await this.load(actor, id);
    if (current.rsWaybillId && current.status === TransferStatus.IN_TRANSIT) {
      const waybill = await this.rsClient.waybill(await this.rsWaybills.companyCredentials(actor), current.rsWaybillId);
      if (waybill.status === RS_ACTIVE || waybill.status === RS_CLOSED) {
        throw new BadRequestException(
          `Waybill ${waybill.number} is still ${waybill.status === RS_ACTIVE ? 'active' : 'closed'} in RS. Cancel it in RS first; then the goods can go back here.`,
        );
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockForChange(manager, actor, id);
      this.assertStatus(transfer, TransferStatus.IN_TRANSIT);
      await this.assertSide(actor, transfer, 'from');
      await this.stockService.post(
        manager,
        actor,
        transfer.lines.map((line) => ({
          productId: line.productId!,
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

  private async updateFromRsDraft(actor: AuthUser, transfer: Transfer, dto: SaveTransferDto): Promise<TransferView> {
    if (dto.lines.length !== transfer.lines.length) {
      throw new BadRequestException("A transfer from an RS waybill keeps the waybill's lines; only their products can change");
    }
    const productIds = dto.lines.map((line) => line.productId ?? null);
    await this.dataSource.transaction(async (manager) => {
      await this.checkProducts(
        manager,
        actor,
        transfer.lines.map((line, i) => ({ productId: productIds[i], quantity: line.quantity })),
      );
      await manager.update(
        Transfer,
        { id: transfer.id, companyId: actor.companyId! },
        { fromWarehouseId: dto.fromWarehouseId, toWarehouseId: dto.toWarehouseId, note: dto.note ?? null },
      );
      for (const [i, line] of transfer.lines.entries()) {
        if (line.productId !== productIds[i]) {
          await manager.update(TransferLine, { id: line.id }, { productId: productIds[i] });
        }
      }
      await rememberRsProducts(manager, actor.companyId!, transfer.rsSellerTin, transfer.lines, productIds);
    });
    const view = await this.findOne(actor, transfer.id);
    await this.audit.record(actor, 'transfer.update', `Updated draft transfer ${view.code} (from RS)`);
    return view;
  }

  private async checkRsBeforeSend(actor: AuthUser, transfer: Transfer): Promise<void> {
    const unlinked = transfer.lines.filter((line) => !line.productId);
    if (unlinked.length) {
      throw new BadRequestException(`Link every line to a product first (${unlinked.map((line) => line.rsName).join(', ')})`);
    }
    for (const line of transfer.lines) {
      const problem = rsUnitProblem(line, line.product);
      if (problem) {
        throw new BadRequestException(problem);
      }
    }
    const waybill = await this.rsClient.waybill(await this.rsWaybills.companyCredentials(actor), transfer.rsWaybillId!);
    this.assertInternal(waybill);
    const changed =
      waybill.goods.length !== transfer.lines.length ||
      waybill.goods.some((goods, i) => round3(goods.quantity) !== transfer.lines[i].quantity || goods.name !== transfer.lines[i].rsName);
    if (changed) {
      throw new BadRequestException(
        `Waybill ${waybill.number} was changed in RS after this transfer was made. Delete this draft and create the transfer again.`,
      );
    }
  }

  private async closeInRs(actor: AuthUser, transfer: Transfer): Promise<void> {
    if (transfer.rsClosedAt) {
      return;
    }
    const credentials = await this.rsWaybills.companyCredentials(actor);
    const waybill = await this.rsClient.waybill(credentials, transfer.rsWaybillId!);
    if (waybill.status !== RS_CLOSED) {
      if (waybill.status !== RS_ACTIVE) {
        throw new BadRequestException(`Waybill ${waybill.number} is no longer active in RS (deleted or cancelled), so it can't be received`);
      }
      const result = await this.rsClient.closeWaybill(credentials, waybill.id, new Date());
      if (result !== '1') {
        throw new BadRequestException(
          `RS did not close waybill ${waybill.number} (${this.rsClient.errorText(result)}). Nothing was received.`,
        );
      }
      await this.audit.record(actor, 'rs.close', `Closed RS waybill ${waybill.number} for ${this.code(transfer)}`);
    }
    await this.transfersRepository.update({ id: transfer.id }, { rsClosedAt: new Date() });
    transfer.rsClosedAt = new Date();
    this.rsWaybills.forgetLists(actor);
  }

  private assertInternal(waybill: RsWaybillDetail): void {
    if (waybill.typeId !== RS_INTERNAL_TYPE) {
      throw new BadRequestException(
        `Waybill ${waybill.number} is ${waybill.typeName ?? 'of another type'}; only internal transfers (შიდა გადაზიდვა) become transfers`,
      );
    }
    if (waybill.status !== RS_ACTIVE && waybill.status !== RS_CLOSED) {
      throw new BadRequestException(`Waybill ${waybill.number} is not active in RS (it was saved only, deleted or cancelled)`);
    }
    if (waybill.goods.length === 0) {
      throw new BadRequestException(`Waybill ${waybill.number} has no goods lines`);
    }
  }

  private requireProducts(lines: { productId: string | null }[]): void {
    if (lines.some((line) => !line.productId)) {
      throw new BadRequestException('Every line needs a product');
    }
  }

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

  private async checkProducts(
    manager: EntityManager,
    actor: AuthUser,
    lines: { productId: string | null; quantity: number }[],
  ): Promise<void> {
    const linked = lines.filter((line): line is { productId: string; quantity: number } => !!line.productId);
    const ids = [...new Set(linked.map((line) => line.productId))];
    if (ids.length !== linked.length) {
      throw new BadRequestException('A product is listed more than once');
    }
    const products = ids.length ? await manager.findBy(Product, { id: In(ids), companyId: actor.companyId! }) : [];
    if (products.length !== ids.length) {
      throw new BadRequestException('One or more products do not exist');
    }
    for (const line of linked) {
      const product = products.find((p) => p.id === line.productId)!;
      if (product.unit === ProductUnit.PCS && !Number.isInteger(line.quantity)) {
        throw new BadRequestException(`${product.name} is counted in pcs, so its quantity must be whole`);
      }
    }
  }

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
              product: product ? { id: product.id, name: product.name, barcode: product.barcode, unit: product.unit } : null,
            })),
          }
        : {}),
    };
  }
}
