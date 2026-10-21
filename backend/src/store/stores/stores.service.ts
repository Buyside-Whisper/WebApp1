import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { EmployeeRole } from '../../hr/employees/employee-role.enum.js';
import { EmployeeStatus } from '../../hr/employees/employee-status.enum.js';
import { RegisterSession } from '../cash-register/register-session.entity.js';
import { Store } from './store.entity.js';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto.js';

export interface PersonRef {
  id: string;
  name: string;
}

export interface StoreView {
  id: string;
  name: string;
  address: string;
  registers: number;
  manager: PersonRef | null;
}

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(RegisterSession)
    private readonly sessionsRepository: Repository<RegisterSession>,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<StoreView[]> {
    const stores = await this.visibleStores(actor).orderBy('store.name', 'ASC').getMany();
    return stores.map(toView);
  }

  async options(actor: AuthUser): Promise<{ managers: PersonRef[] }> {
    const people = await this.employeesRepository.find({
      where: { companyId: actor.companyId!, module: AppModuleName.STORE },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    const active = people.filter((person) => person.status === EmployeeStatus.ACTIVE);
    return {
      managers: active.filter((p) => p.role === EmployeeRole.MANAGER).map(toPerson),
    };
  }

  async create(actor: AuthUser, dto: CreateStoreDto): Promise<StoreView> {
    const store = this.storesRepository.create({
      name: dto.name,
      address: dto.address,
      registers: dto.registers ?? 1,
      companyId: actor.companyId!,
      managerId: await this.checkedManagerId(actor, dto.managerId),
    });
    const saved = await this.storesRepository.save(store);
    await this.audit.record(actor, 'store.create', `Created store ${saved.name}`);
    return this.findOne(actor, saved.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateStoreDto): Promise<StoreView> {
    const store = await this.findEntity(actor, id);
    const { managerId, ...fields } = dto;

    if (fields.registers !== undefined) {
      const open = await this.sessionsRepository.find({ where: { storeId: id, closedAt: IsNull() } });
      const highest = Math.max(0, ...open.map((session) => session.registerNo));
      if (fields.registers < highest) {
        throw new BadRequestException(`Register ${highest} is open right now, so the store needs at least ${highest} registers`);
      }
    }
    Object.assign(store, fields);
    if (managerId !== undefined) {
      store.managerId = await this.checkedManagerId(actor, managerId);
    }
    await this.storesRepository.save(store);
    await this.audit.record(actor, 'store.update', `Updated store ${store.name}`);
    return this.findOne(actor, id);
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const store = await this.findEntity(actor, id);
    await this.storesRepository.remove(store);
    await this.audit.record(actor, 'store.delete', `Deleted store ${store.name}`);
  }

  private async findOne(actor: AuthUser, id: string): Promise<StoreView> {
    return toView(await this.findEntity(actor, id));
  }

  private async findEntity(actor: AuthUser, id: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { manager: true },
    });

    if (!store) {
      throw new NotFoundException(`Store ${id} not found`);
    }

    return store;
  }

  private visibleStores(actor: AuthUser): SelectQueryBuilder<Store> {
    const query = this.storesRepository
      .createQueryBuilder('store')
      .leftJoinAndSelect('store.manager', 'manager')
      .where('store.companyId = :companyId', { companyId: actor.companyId });

    if (actor.role === UserRole.MANAGER) {
      query.andWhere('store.managerId = :employeeId', { employeeId: actor.employeeId });
    } else if (actor.role === UserRole.CASHIER) {
      query.andWhere('store.id IN (SELECT store_id FROM store_employees WHERE employee_id = :employeeId)', {
        employeeId: actor.employeeId,
      });
    }
    return query;
  }

  private async checkedManagerId(actor: AuthUser, managerId: string | null | undefined): Promise<string | null> {
    if (!managerId) {
      return null;
    }
    const manager = await this.employeesRepository.findOne({
      where: { id: managerId, companyId: actor.companyId!, module: AppModuleName.STORE, role: EmployeeRole.MANAGER },
    });
    if (!manager) {
      throw new BadRequestException('The manager must be an employee with the manager role in Store');
    }
    return manager.id;
  }
}

function toPerson(employee: Employee): PersonRef {
  return { id: employee.id, name: `${employee.firstName} ${employee.lastName}` };
}

function toView(store: Store): StoreView {
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    registers: store.registers,
    manager: store.manager ? toPerson(store.manager) : null,
  };
}
