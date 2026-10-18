import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { Credentials, UsersService } from '../../auth/users.service.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { User } from '../../auth/user.entity.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { Store } from '../../store/stores/store.entity.js';
import { Warehouse } from '../../wms/warehouses/warehouse.entity.js';
import { Employee } from './employee.entity.js';
import { EmployeeRole } from './employee-role.enum.js';
import { EmployeeStatus } from './employee-status.enum.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

const USER_ROLES: Record<EmployeeRole, UserRole> = {
  [EmployeeRole.SYSTEM_ADMIN]: UserRole.MODULE_ADMIN,
  [EmployeeRole.ADMIN]: UserRole.MODULE_ADMIN,
  [EmployeeRole.MANAGER]: UserRole.MANAGER,
  [EmployeeRole.CASHIER]: UserRole.CASHIER,
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<Employee[]> {
    const ids = await this.visibleIds(actor);
    if (ids && ids.length === 0) {
      return [];
    }
    const employees = await this.employeesRepository.find({
      where: { ...this.scope(actor), ...(ids ? { id: In(ids) } : {}) },
      order: { createdAt: 'DESC' },
    });
    return this.withUsernames(employees);
  }

  async findOne(actor: AuthUser, id: string): Promise<Employee> {
    const ids = await this.visibleIds(actor);
    const employee =
      ids && !ids.includes(id)
        ? null
        : await this.employeesRepository.findOne({
            where: { ...this.scope(actor), id },
          });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return employee;
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto): Promise<Employee> {
    const { workplaceIds, ...fields } = dto;
    const { role, module } = this.resolveRoleAndModule(
      actor,
      dto.role ?? null,
      dto.module ?? null,
    );

    const link =
      actor.role === UserRole.MANAGER
        ? await this.prepareWorkplaces(actor, workplaceIds ?? [])
        : null;
    const employee = this.employeesRepository.create({
      ...fields,
      role,
      module,
      companyId: actor.companyId!,
    });
    this.assertValidDates(employee);
    const saved = await this.save(employee);
    await link?.(saved);
    await this.audit.record(
      actor,
      'employee.create',
      `Added ${this.nameOf(saved)} (${saved.role ?? 'no role'})`,
    );
    return saved;
  }

  async create1(actor: AuthUser, dto: CreateEmployeeDto): Promise<Employee> {
    const { workplaceIds, ...fields } = dto;
    const role = EmployeeRole.SYSTEM_ADMIN;
    const module = null;

    const link =
      actor.role === UserRole.MANAGER
        ? await this.prepareWorkplaces(actor, workplaceIds ?? [])
        : null;
    const employee = this.employeesRepository.create({
      ...fields,
      role,
      module,
      companyId: actor.companyId!,
    });
    this.assertValidDates(employee);
    const saved = await this.save(employee);
    await link?.(saved);
    await this.audit.record(
      actor,
      'employee.create',
      `Added ${this.nameOf(saved)} (${saved.role ?? 'no role'})`,
    );
    return saved;
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    const employee = await this.findOne(actor, id);
    this.assertCanChange(actor, employee);

    const { role, module, ...fields } = dto;
    Object.assign(employee, fields);
    if (role !== undefined || module !== undefined) {
      const resolved = this.resolveRoleAndModule(
        actor,
        role === undefined ? employee.role : role,
        module === undefined ? employee.module : module,
      );
      employee.role = resolved.role;
      employee.module = resolved.module;
    }
    this.assertValidDates(employee);
    const saved = await this.save(employee);
    await this.syncLogin(saved);
    await this.audit.record(
      actor,
      'employee.update',
      `Updated ${this.nameOf(saved)}`,
    );
    return saved;
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const employee = await this.findOne(actor, id);
    this.assertCanChange(actor, employee);
    await this.employeesRepository.remove(employee); // the login goes with it
    await this.audit.record(
      actor,
      'employee.delete',
      `Removed ${this.nameOf(employee)}`,
    );
  }

  async issueCredentials(actor: AuthUser, id: string): Promise<Credentials> {
    const employee = await this.findOne(actor, id);
    this.assertCanChange(actor, employee);

    if (!employee.role || !employee.module) {
      throw new BadRequestException(
        'People without a role have no access to the app, so no login.',
      );
    }
    const role = USER_ROLES[employee.role];
    if (employee.status === EmployeeStatus.FORMER) {
      throw new BadRequestException('This employee has left the company');
    }

    const existing = await this.users.findByEmployeeId(employee.id);
    if (existing) {
      const credentials = await this.users.resetPassword(existing);
      await this.audit.record(
        actor,
        'credentials.reset',
        `Reset the password of ${this.nameOf(employee)}`,
      );
      return credentials;
    }

    const credentials = await this.users.create({
      role,
      module: employee.module,
      companyId: actor.companyId!,
      companyName: actor.companyName!,
      displayName: this.nameOf(employee),
      employeeId: employee.id,
    });

    await this.audit.record(
      actor,
      'credentials.issue',
      `Issued a login for ${this.nameOf(employee)} (${role})`,
    );
    return credentials;
  }

  private scope(actor: AuthUser): FindOptionsWhere<Employee> {
    switch (actor.role) {
      case UserRole.MODULE_ADMIN:
        return { companyId: actor.companyId!, module: actor.module! };
      default:
        return { companyId: actor.companyId! };
    }
  }

  private async visibleIds(actor: AuthUser): Promise<string[] | null> {
    if (actor.role !== UserRole.MANAGER) {
      return null;
    }
    const where = { companyId: actor.companyId!, managerId: actor.employeeId! };
    const workplaces =
      actor.module === AppModuleName.WMS
        ? await this.warehousesRepository.find({
            where,
            relations: { members: true },
          })
        : await this.storesRepository.find({
            where,
            relations: { members: true },
          });
    return workplaces.flatMap((workplace) =>
      workplace.members.map((member) => member.id),
    );
  }

  private async prepareWorkplaces(
    actor: AuthUser,
    ids: string[],
  ): Promise<(person: Employee) => Promise<void>> {
    const uniqueIds = [...new Set(ids)];
    const kind = actor.module === AppModuleName.WMS ? 'warehouse' : 'store';
    if (uniqueIds.length === 0) {
      throw new BadRequestException(
        `Choose the ${kind}(s) this person works in`,
      );
    }
    const where = {
      id: In(uniqueIds),
      companyId: actor.companyId!,
      managerId: actor.employeeId!,
    };

    if (actor.module === AppModuleName.WMS) {
      const warehouses = await this.warehousesRepository.find({
        where,
        relations: { members: true },
      });
      if (warehouses.length !== uniqueIds.length) {
        throw new BadRequestException(
          'You can only pick warehouses that you manage',
        );
      }
      return async (person) => {
        for (const warehouse of warehouses) {
          warehouse.members = [...warehouse.members, person];
        }
        await this.warehousesRepository.save(warehouses);
      };
    }

    const stores = await this.storesRepository.find({
      where,
      relations: { members: true },
    });
    if (stores.length !== uniqueIds.length) {
      throw new BadRequestException('You can only pick stores that you manage');
    }
    return async (person) => {
      for (const store of stores) {
        store.members = [...store.members, person];
      }
      await this.storesRepository.save(stores);
    };
  }

  private resolveRoleAndModule(
    actor: AuthUser,
    role: EmployeeRole | null,
    requested: AppModuleName | null,
  ): { role: EmployeeRole | null; module: AppModuleName | null } {
    let module = requested;

    if (actor.role === UserRole.MODULE_ADMIN) {
      if (role !== null && role !== EmployeeRole.MANAGER) {
        throw new ForbiddenException(
          'Module admins can only give the manager role',
        );
      }
      module = actor.module;
    } else if (actor.role === UserRole.MANAGER) {
      if (
        role !== null &&
        !(role === EmployeeRole.CASHIER && actor.module === AppModuleName.STORE)
      ) {
        throw new ForbiddenException(
          actor.module === AppModuleName.STORE
            ? 'Managers can only give the cashier role'
            : 'WMS managers can only add people without a role',
        );
      }
      module = actor.module;
    } else if (role === null) {
      module = null;
    } else if (role !== EmployeeRole.ADMIN) {
      throw new ForbiddenException(
        'The system admin can only give the module admin role',
      );
    }
    if (role !== null && !module) {
      throw new BadRequestException('Choose a module for this role');
    }
    if (module && !actor.companyModules.includes(module)) {
      throw new BadRequestException(
        `Your company has not bought the ${module.toUpperCase()} module`,
      );
    }
    if (role === EmployeeRole.CASHIER && module !== AppModuleName.STORE) {
      throw new BadRequestException('Cashiers belong to the Store module');
    }
    return { role, module };
  }

  private assertCanChange(actor: AuthUser, employee: Employee): void {
    if (
      actor.role === UserRole.MODULE_ADMIN &&
      employee.role !== null &&
      employee.role !== EmployeeRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Module admins can only change managers and people without a role',
      );
    }
    if (
      actor.role === UserRole.MANAGER &&
      employee.role !== null &&
      employee.role !== EmployeeRole.CASHIER
    ) {
      throw new ForbiddenException(
        'Managers can only change cashiers and people without a role',
      );
    }
  }

  private async syncLogin(employee: Employee): Promise<void> {
    const user = await this.users.findByEmployeeId(employee.id);
    if (!user) {
      return;
    }
    if (!employee.role || !employee.module) {
      await this.usersRepository.remove(user);
      return;
    }
    user.role = USER_ROLES[employee.role];
    user.module = employee.module;
    user.displayName = this.nameOf(employee);
    await this.usersRepository.save(user);
  }

  private async withUsernames(employees: Employee[]): Promise<Employee[]> {
    if (employees.length === 0) {
      return employees;
    }
    const users = await this.usersRepository.find({
      where: { employeeId: In(employees.map((e) => e.id)) },
      select: { employeeId: true, username: true },
    });
    const byEmployee = new Map(users.map((u) => [u.employeeId, u.username]));
    for (const employee of employees) {
      employee.username = byEmployee.get(employee.id) ?? null;
    }
    return employees;
  }

  private nameOf(employee: Employee): string {
    return `${employee.firstName} ${employee.lastName}`;
  }

  private async save(employee: Employee): Promise<Employee> {
    try {
      return await this.employeesRepository.save(employee);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `An employee with personal ID ${employee.personalId} already exists`,
        );
      }
      throw error;
    }
  }

  // Dates are 'YYYY-MM-DD' strings, so comparing them as strings compares them as dates.
  private assertValidDates(employee: Employee): void {
    const today = new Date().toISOString().slice(0, 10);

    if (employee.birthDate && employee.birthDate >= today) {
      throw new BadRequestException('Date of birth must be in the past');
    }
    if (
      employee.birthDate &&
      employee.hireDate &&
      employee.hireDate < employee.birthDate
    ) {
      throw new BadRequestException(
        'Hire date cannot be before the date of birth',
      );
    }
    if (
      employee.hireDate &&
      employee.endDate &&
      employee.endDate < employee.hireDate
    ) {
      throw new BadRequestException('End date cannot be before the hire date');
    }
  }
}
