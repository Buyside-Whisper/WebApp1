import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { EmployeeRole } from '../../hr/employees/employee-role.enum.js';
import { EmployeeStatus } from '../../hr/employees/employee-status.enum.js';
import { ProductWarehouse } from '../stock/product-warehouse.entity.js';
import { StockService } from '../stock/stock.service.js';
import { Warehouse } from './warehouse.entity.js';
import { WarehouseType } from './warehouse-type.enum.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

const CODE_PREFIXES: Record<WarehouseType, string> = {
  [WarehouseType.MAIN]: 'WH-MAIN',
  [WarehouseType.SALES]: 'WH-SALE',
};

export type WarehouseOption = Pick<Warehouse, 'id' | 'code' | 'name' | 'type' | 'status' | 'branch'> & {
  // True when the current user may work with it (admins: all; a manager: the ones he runs).
  mine: boolean;
};

export interface ManagerOption {
  id: string;
  name: string;
}

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(ProductWarehouse)
    private readonly productWarehousesRepository: Repository<ProductWarehouse>,
    private readonly stockService: StockService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<Warehouse[]> {
    const warehouses = await this.warehousesRepository.find({
      where:
        actor.role === UserRole.MANAGER
          ? { companyId: actor.companyId!, managerId: actor.employeeId! }
          : { companyId: actor.companyId! },
      relations: { manager: true },
      order: { code: 'ASC' },
    });
    return this.withTotals(
      actor,
      warehouses.map((warehouse) => this.withoutPersonalData(warehouse)),
    );
  }

  async findOne(actor: AuthUser, id: string): Promise<Warehouse> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { manager: true },
    });

    // A manager may only open the warehouses he runs.
    if (
      !warehouse ||
      (actor.role === UserRole.MANAGER && warehouse.managerId !== actor.employeeId)
    ) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    const [withTotals] = await this.withTotals(actor, [
      this.withoutPersonalData(warehouse),
    ]);
    return withTotals;
  }

  async options(actor: AuthUser): Promise<WarehouseOption[]> {
    const warehouses = await this.warehousesRepository.find({
      where: { companyId: actor.companyId! },
      order: { code: 'ASC' },
    });
    return warehouses.map(({ id, code, name, type, status, branch, managerId }) => ({
      id,
      code,
      name,
      type,
      status,
      branch,
      mine: actor.role !== UserRole.MANAGER || managerId === actor.employeeId,
    }));
  }

  // Employees who can be picked as a warehouse manager: active managers of the WMS module.
  async managerOptions(actor: AuthUser): Promise<ManagerOption[]> {
    const managers = await this.employeesRepository.find({
      where: {
        companyId: actor.companyId!,
        role: EmployeeRole.MANAGER,
        module: AppModuleName.WMS,
      },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return managers
      .filter((manager) => manager.status === EmployeeStatus.ACTIVE)
      .map((manager) => ({
        id: manager.id,
        name: `${manager.firstName} ${manager.lastName}`,
      }));
  }

  async create(actor: AuthUser, dto: CreateWarehouseDto): Promise<Warehouse> {
    const warehouse = this.warehousesRepository.create({
      ...dto,
      managerId: await this.checkedManagerId(actor, dto.managerId),
      companyId: actor.companyId!,
    });
    this.applyBranchRule(warehouse);
    warehouse.code = await this.nextCode(actor.companyId!, dto.type);
    const saved = await this.warehousesRepository.save(warehouse);
    await this.audit.record(
      actor,
      'warehouse.create',
      `Created warehouse ${saved.code} ${saved.name}`,
    );
    return this.findOne(actor, saved.id);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findEntity(actor, id);

    // The code encodes the type, so a type change gets a new code.
    if (dto.type && dto.type !== warehouse.type) {
      warehouse.code = await this.nextCode(actor.companyId!, dto.type);
    }

    const { managerId, ...fields } = dto;
    // Only the fields that were sent (a DTO instance also carries the missing ones as undefined).
    Object.assign(
      warehouse,
      Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    );
    this.applyBranchRule(warehouse);
    if (managerId !== undefined) {
      warehouse.managerId = await this.checkedManagerId(actor, managerId);
    }
    delete (warehouse as Partial<Warehouse>).manager; // the id column is the source of truth
    await this.warehousesRepository.save(warehouse);
    await this.audit.record(
      actor,
      'warehouse.update',
      `Updated warehouse ${warehouse.code} ${warehouse.name}`,
    );
    return this.findOne(actor, id);
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const warehouse = await this.findEntity(actor, id);
    // Its stock history would point at nothing; an unused warehouse can be set to Inactive instead.
    if (await this.stockService.hasHistory(actor, { warehouseId: id })) {
      throw new ConflictException(
        `${warehouse.code} has stock history, so it can't be deleted. Set it to Inactive instead.`,
      );
    }
    await this.warehousesRepository.remove(warehouse);
    await this.audit.record(
      actor,
      'warehouse.delete',
      `Deleted warehouse ${warehouse.code} ${warehouse.name}`,
    );
  }

  private async findEntity(actor: AuthUser, id: string): Promise<Warehouse> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id, companyId: actor.companyId! },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    return warehouse;
  }

  // A sales warehouse belongs to one branch; a main warehouse serves all of them, so it has none.
  private applyBranchRule(warehouse: Warehouse): void {
    if (warehouse.type === WarehouseType.MAIN) {
      warehouse.branch = null;
    } else if (!warehouse.branch) {
      throw new BadRequestException('A sales warehouse needs a branch');
    }
  }

  // The picked manager must be a WMS manager of the same company.
  private async checkedManagerId(
    actor: AuthUser,
    managerId: string | null | undefined,
  ): Promise<string | null> {
    if (!managerId) {
      return null;
    }
    const manager = await this.employeesRepository.findOne({
      where: {
        id: managerId,
        companyId: actor.companyId!,
        role: EmployeeRole.MANAGER,
        module: AppModuleName.WMS,
      },
    });
    if (!manager) {
      throw new BadRequestException(
        'The manager must be an employee with the manager role in WMS',
      );
    }
    return manager.id;
  }

  // The manager comes back as just his id and name, not the whole HR record.
  private withoutPersonalData(warehouse: Warehouse): Warehouse {
    if (warehouse.manager) {
      const { id, firstName, lastName } = warehouse.manager;
      warehouse.manager = { id, firstName, lastName };
    }
    return warehouse;
  }

  // Adds the product count, stock and total cost, summed from the products in each warehouse.
  private async withTotals(
    actor: AuthUser,
    warehouses: Warehouse[],
  ): Promise<Warehouse[]> {
    const rows: {
      warehouseId: string;
      productCount: string;
      stockPcs: string;
      stockKg: string;
      totalCost: string;
    }[] = warehouses.length
      ? await this.productWarehousesRepository
          .createQueryBuilder('pw')
          .innerJoin('pw.product', 'p')
          .select('pw.warehouse_id', 'warehouseId')
          .addSelect('COUNT(*)', 'productCount')
          .addSelect(`COALESCE(SUM(pw.quantity) FILTER (WHERE p.unit = 'pcs'), 0)`, 'stockPcs')
          .addSelect(`COALESCE(SUM(pw.quantity) FILTER (WHERE p.unit = 'kg'), 0)`, 'stockKg')
          .addSelect('COALESCE(SUM(pw.quantity * p.cost_price), 0)', 'totalCost')
          .where({
            companyId: actor.companyId!,
            warehouseId: In(warehouses.map((w) => w.id)),
          })
          .groupBy('pw.warehouse_id')
          .getRawMany()
      : [];
    const byWarehouse = new Map(rows.map((row) => [row.warehouseId, row]));

    return warehouses.map((warehouse) => {
      const row = byWarehouse.get(warehouse.id);
      warehouse.productCount = Number(row?.productCount ?? 0);
      warehouse.stockPcs = Number(row?.stockPcs ?? 0);
      warehouse.stockKg = Number(row?.stockKg ?? 0);
      // Quantity has 3 decimals and price 2, so round the product to whole tetri.
      warehouse.totalCost = Math.round(Number(row?.totalCost ?? 0) * 100) / 100;
      return warehouse;
    });
  }

  // Highest existing number for the type's prefix + 1, e.g. WH-SALE-02 -> WH-SALE-03.
  private async nextCode(
    companyId: string,
    type: WarehouseType,
  ): Promise<string> {
    const prefix = CODE_PREFIXES[type];
    const existing = await this.warehousesRepository.find({
      select: { code: true },
      where: { companyId, code: Like(`${prefix}-%`) },
    });
    const highest = Math.max(
      0,
      ...existing.map((w) => Number(w.code.slice(prefix.length + 1)) || 0),
    );
    return `${prefix}-${String(highest + 1).padStart(2, '0')}`;
  }
}
