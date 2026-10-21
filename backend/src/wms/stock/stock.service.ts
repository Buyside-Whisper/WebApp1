import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Product } from '../products/product.entity.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { ProductWarehouse } from './product-warehouse.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { StockMovementKind } from './stock-movement-kind.enum.js';

export interface StockLine {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export interface PostOptions {
  kind: StockMovementKind;
  documentId?: string | null;
  note?: string | null;
}

export interface WarehouseStockRow {
  productId: string;
  quantity: number;
  product: Pick<Product, 'id' | 'name' | 'barcode' | 'category' | 'group' | 'unit' | 'costPrice' | 'status'>;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    @InjectRepository(ProductWarehouse)
    private readonly balancesRepository: Repository<ProductWarehouse>,
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
  ) {}

  async post(
    manager: EntityManager,
    actor: AuthUser,
    lines: StockLine[],
    options: PostOptions,
  ): Promise<StockMovement[]> {
    const companyId = actor.companyId!;
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const warehouseIds = [...new Set(lines.map((line) => line.warehouseId))];
    const products = await manager.findBy(Product, { id: In(productIds), companyId });
    const warehouses = await manager.findBy(Warehouse, { id: In(warehouseIds), companyId });
    if (products.length !== productIds.length || warehouses.length !== warehouseIds.length) {
      throw new BadRequestException('One or more products or warehouses do not exist');
    }
    const productsById = new Map(products.map((product) => [product.id, product]));
    const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

    const movements: StockMovement[] = [];
    for (const line of lines) {
      const product = productsById.get(line.productId)!;
      const warehouse = warehousesById.get(line.warehouseId)!;
      if (line.quantity === 0) {
        continue;
      }
      if (product.unit === ProductUnit.PCS && !Number.isInteger(line.quantity)) {
        throw new BadRequestException(`${product.name} is counted in pcs, so its quantity must be whole`);
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into(ProductWarehouse)
        .values({ companyId, productId: product.id, warehouseId: warehouse.id, quantity: 0 })
        .orIgnore()
        .execute();
      const balance = await manager.findOne(ProductWarehouse, {
        where: { productId: product.id, warehouseId: warehouse.id },
        lock: { mode: 'pessimistic_write' },
      });
      const after = round3(balance!.quantity + line.quantity);
      if (after < 0) {
        throw new BadRequestException(
          `Not enough ${product.name} in ${warehouse.code}: ${balance!.quantity} ${product.unit} available`,
        );
      }
      await manager.update(
        ProductWarehouse,
        { productId: product.id, warehouseId: warehouse.id },
        { quantity: after },
      );
      movements.push(
        manager.create(StockMovement, {
          companyId,
          kind: options.kind,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: line.quantity,
          balanceAfter: after,
          documentId: options.documentId ?? null,
          note: options.note ?? null,
          createdByName: actor.displayName,
        }),
      );
    }
    return manager.save(StockMovement, movements);
  }

  async managedWarehouseIds(actor: AuthUser): Promise<Set<string>> {
    if (actor.role !== UserRole.MANAGER) {
      return new Set();
    }
    const warehouses = await this.warehousesRepository.find({
      select: { id: true },
      where: { companyId: actor.companyId!, managerId: actor.employeeId! },
    });
    return new Set(warehouses.map((warehouse) => warehouse.id));
  }

  hasHistory(actor: AuthUser, where: { productId?: string; warehouseId?: string }): Promise<boolean> {
    return this.movementsRepository.exists({ where: { ...where, companyId: actor.companyId! } });
  }

  async movements(
    actor: AuthUser,
    filter: { productId?: string; warehouseId?: string },
  ): Promise<StockMovement[]> {
    if (!filter.productId === !filter.warehouseId) {
      throw new BadRequestException('Give either productId or warehouseId');
    }
    if (filter.warehouseId) {
      await this.checkWarehouse(actor, filter.warehouseId);
    } else if (actor.role === UserRole.MANAGER) {
      throw new NotFoundException('Product not found');
    }

    const movements = await this.movementsRepository.find({
      where: filter.productId
        ? { companyId: actor.companyId!, productId: filter.productId }
        : { companyId: actor.companyId!, warehouseId: filter.warehouseId },
      relations: { product: true, warehouse: true },
      order: { createdAt: 'DESC' },
      take: 1000,
    });
    return movements.map((movement) => ({
      ...movement,
      product: { id: movement.product!.id, name: movement.product!.name, barcode: movement.product!.barcode, unit: movement.product!.unit },
      warehouse: { id: movement.warehouse!.id, code: movement.warehouse!.code, name: movement.warehouse!.name },
    })) as StockMovement[];
  }

  async warehouseStock(actor: AuthUser, warehouseId: string): Promise<WarehouseStockRow[]> {
    await this.checkWarehouse(actor, warehouseId);
    const rows = await this.balancesRepository.find({
      where: { companyId: actor.companyId!, warehouseId },
      relations: { product: true },
      order: { product: { name: 'ASC' } },
    });
    return rows.map(({ productId, quantity, product }) => ({
      productId,
      quantity,
      product: {
        id: product!.id,
        name: product!.name,
        barcode: product!.barcode,
        category: product!.category,
        group: product!.group,
        unit: product!.unit,
        costPrice: product!.costPrice,
        status: product!.status,
      },
    }));
  }

  private async checkWarehouse(actor: AuthUser, warehouseId: string): Promise<void> {
    const warehouse = await this.warehousesRepository.findOneBy({ id: warehouseId, companyId: actor.companyId! });
    if (!warehouse || (actor.role === UserRole.MANAGER && warehouse.managerId !== actor.employeeId)) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
  }
}
