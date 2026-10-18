import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Credentials, UsersService } from '../../auth/users.service.js';
import { User } from '../../auth/user.entity.js';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { Company } from '../../companies/company.entity.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { PosService } from '../../store/pos/pos.service.js';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto.js';

export interface CompanyView {
  id: string;
  name: string;
  modules: AppModuleName[];
  createdAt: Date;
  adminName: string | null;
  adminUsername: string | null;
  employeeCount: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly users: UsersService,
    private readonly pos: PosService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<CompanyView[]> {
    const companies = await this.companiesRepository.find({
      order: { createdAt: 'DESC' },
    });
    return Promise.all(companies.map((company) => this.toView(company)));
  }

  async create(
    actor: AuthUser,
    dto: CreateCompanyDto,
  ): Promise<{ company: CompanyView; credentials: Credentials }> {
    let company: Company;
    try {
      company = await this.companiesRepository.save(
        this.companiesRepository.create({
          name: dto.name,
          modules: dto.modules,
        }),
      );
    } catch (error) {
      throw this.asConflict(error, dto.name);
    }

    const credentials = await this.users.create({
      role: UserRole.SYSTEM_ADMIN,
      module: null,
      companyId: company.id,
      companyName: company.name,
      displayName: `${dto.adminFirstName} ${dto.adminLastName}`,
    });

    await this.setUpModules(company);
    await this.audit.record(
      actor,
      'company.create',
      `Created company ${company.name} with modules: ${company.modules.join(', ') || 'none'}`,
      company.id,
    );
    return { company: await this.toView(company), credentials };
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyView> {
    const company = await this.findEntity(id);
    Object.assign(company, dto);
    try {
      await this.companiesRepository.save(company);
    } catch (error) {
      throw this.asConflict(error, company.name);
    }
    await this.setUpModules(company);
    await this.audit.record(
      actor,
      'company.update',
      `Updated ${company.name}: modules are now ${company.modules.join(', ') || 'none'}`,
      company.id,
    );
    return this.toView(company);
  }

  async resetAdminPassword(actor: AuthUser, id: string): Promise<Credentials> {
    const company = await this.findEntity(id);
    const admin = await this.usersRepository.findOneByOrFail({
      companyId: id,
      role: UserRole.SYSTEM_ADMIN,
    });
    const credentials = await this.users.resetPassword(admin);
    await this.audit.record(
      actor,
      'credentials.reset',
      `Reset the system admin password of ${company.name}`,
      id,
    );
    return credentials;
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const company = await this.findEntity(id);
    await this.companiesRepository.remove(company);
    await this.audit.record(
      actor,
      'company.delete',
      `Deleted company ${company.name}`,
      null,
    );
  }

  private async setUpModules(company: Company): Promise<void> {
    if (company.modules.includes(AppModuleName.STORE)) {
      await this.pos.ensureSampleProducts(company.id);
    }
  }

  private async findEntity(id: string): Promise<Company> {
    const company = await this.companiesRepository.findOneBy({ id });

    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }

    return company;
  }

  private async toView(company: Company): Promise<CompanyView> {
    const admin = await this.usersRepository.findOneBy({
      companyId: company.id,
      role: UserRole.SYSTEM_ADMIN,
    });
    return {
      id: company.id,
      name: company.name,
      modules: company.modules,
      createdAt: company.createdAt,
      adminName: admin?.displayName ?? null,
      adminUsername: admin?.username ?? null,
      employeeCount: await this.employeesRepository.countBy({
        companyId: company.id,
      }),
    };
  }

  private asConflict(error: unknown, name: string): unknown {
    return isUniqueViolation(error)
      ? new ConflictException(`A company named "${name}" already exists`)
      : error;
  }
}
