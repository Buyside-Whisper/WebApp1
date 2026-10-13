import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { EmployeeRole } from '../../hr/employees/employee-role.enum.js';
import { EmployeeStatus } from '../../hr/employees/employee-status.enum.js';
import { Warehouse } from './warehouse.entity.js';
import { WarehouseType } from './warehouse-type.enum.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

const CODE_PREFIXES: Record<WarehouseType, string> = {
  [WarehouseType.MAIN]: 'WH-MAIN',
  [WarehouseType.SALES]: 'WH-SALE',
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
    return warehouses.map((warehouse) => this.withoutPersonalData(warehouse));
  }

  async findOne(actor: AuthUser, id: string): Promise<Warehouse> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { manager: true },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    return this.withoutPersonalData(warehouse);
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
    Object.assign(warehouse, fields);
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
