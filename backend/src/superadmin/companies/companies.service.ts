import {
  BadRequestException,
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
import { CompanyStatus } from '../../companies/company-status.enum.js';
import { LegalForm } from '../../companies/legal-form.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { PosService } from '../../store/pos/pos.service.js';
import { Billing, billingOf } from './billing.js';
import { CompanyPayment } from './company-payment.entity.js';
import { CreateCompanyDto, CreatePaymentDto, UpdateCompanyDto } from './dto/company.dto.js';

export interface CompanyView {
  id: string;
  name: string;
  legalName: string | null;
  legalForm: LegalForm | null;
  identificationCode: string | null;
  modules: AppModuleName[];
  modulePrices: Partial<Record<AppModuleName, number>>;
  status: CompanyStatus;
  subscriptionStart: string | null;
  trialEndsOn: string | null;
  billing: Billing;
  createdAt: Date;
  adminName: string | null;
  adminUsername: string | null;
  employeeCount: number;
}

export interface CompanyDetail extends CompanyView {
  vatPayer: boolean;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  updatedAt: Date;
  payments: CompanyPayment[];
  totalPaid: number;
}

const MAX_MODULE_PRICE = 100_000;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(CompanyPayment)
    private readonly paymentsRepository: Repository<CompanyPayment>,
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

  async findOne(id: string): Promise<CompanyDetail> {
    return this.toDetail(await this.findEntity(id));
  }

  async create(
    actor: AuthUser,
    dto: CreateCompanyDto,
  ): Promise<{ company: CompanyDetail; credentials: Credentials }> {
    const { adminFirstName, adminLastName, ...fields } = dto;
    const company = this.companiesRepository.create({ ...fields, status: CompanyStatus.ACTIVE });
    this.checkProfile(company);
    const saved = await this.save(company);

    const credentials = await this.users.create({
      role: UserRole.SYSTEM_ADMIN,
      module: null,
      companyId: saved.id,
      companyName: saved.name,
      displayName: `${adminFirstName} ${adminLastName}`,
    });

    await this.setUpModules(saved);
    await this.audit.record(
      actor,
      'company.create',
      `Sold to ${saved.name}: ${this.describeModules(saved)}`,
      saved.id,
    );
    return { company: await this.toDetail(saved), credentials };
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyDetail> {
    const company = await this.findEntity(id);
    const previousStatus = company.status;
    Object.assign(
      company,
      Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    );
    this.checkProfile(company);
    await this.save(company);
    await this.setUpModules(company);

    if (company.status !== previousStatus) {
      const action = {
        [CompanyStatus.ACTIVE]: 'reactivate',
        [CompanyStatus.SUSPENDED]: 'suspend',
        [CompanyStatus.CANCELLED]: 'cancel',
      }[company.status];
      await this.audit.record(
        actor,
        `company.${action}`,
        `${company.name} is now ${company.status} (was ${previousStatus})`,
        company.id,
      );
    } else {
      await this.audit.record(
        actor,
        'company.update',
        `Updated ${company.name}: ${this.describeModules(company)}`,
        company.id,
      );
    }
    return this.toDetail(company);
  }

  async addPayment(actor: AuthUser, id: string, dto: CreatePaymentDto): Promise<CompanyDetail> {
    const company = await this.findEntity(id);
    if (dto.periodTo < dto.periodFrom) {
      throw new BadRequestException('The period must end on or after the day it starts');
    }
    await this.paymentsRepository.save(
      this.paymentsRepository.create({ ...dto, companyId: id, recordedBy: actor.displayName }),
    );
    await this.audit.record(
      actor,
      'company.payment',
      `Recorded ₾${dto.amount.toFixed(2)} from ${company.name} for ${dto.periodFrom} – ${dto.periodTo}`,
      id,
    );
    return this.toDetail(company);
  }

  async removePayment(actor: AuthUser, id: string, paymentId: string): Promise<CompanyDetail> {
    const company = await this.findEntity(id);
    const payment = await this.paymentsRepository.findOneBy({ id: paymentId, companyId: id });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    await this.paymentsRepository.remove(payment);
    await this.audit.record(
      actor,
      'company.payment_delete',
      `Deleted the ₾${payment.amount.toFixed(2)} payment of ${company.name} for ${payment.periodFrom} – ${payment.periodTo}`,
      id,
    );
    return this.toDetail(company);
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

  private checkProfile(company: Company): void {
    if (company.identificationCode && company.legalForm) {
      const length = company.legalForm === LegalForm.INDIVIDUAL_ENTREPRENEUR ? 11 : 9;
      if (company.identificationCode.length !== length) {
        throw new BadRequestException(
          company.legalForm === LegalForm.INDIVIDUAL_ENTREPRENEUR
            ? "An individual entrepreneur's identification code is the 11-digit personal ID"
            : 'A company identification code has 9 digits',
        );
      }
    }
    if (company.trialEndsOn && company.subscriptionStart && company.trialEndsOn < company.subscriptionStart) {
      throw new BadRequestException('The trial cannot end before the subscription starts');
    }

    const prices: Partial<Record<AppModuleName, number>> = {};
    for (const module of company.modules) {
      const price = company.modulePrices?.[module];
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_MODULE_PRICE) {
        throw new BadRequestException(`Enter a monthly price for ${module.toUpperCase()} (₾0 or more)`);
      }
      if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
        throw new BadRequestException(`The ${module.toUpperCase()} price can have at most 2 decimals`);
      }
      prices[module] = Math.round(price * 100) / 100;
    }
    company.modulePrices = prices;
  }

  private async save(company: Company): Promise<Company> {
    try {
      return await this.companiesRepository.save(company);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const taken = await this.companiesRepository.findOneBy({ name: company.name });
        throw new ConflictException(
          taken && taken.id !== company.id
            ? `A company named "${company.name}" already exists`
            : `Identification code ${company.identificationCode} already belongs to another company`,
        );
      }
      throw error;
    }
  }

  private describeModules(company: Company): string {
    const parts = company.modules.map(
      (module) => `${module.toUpperCase()} ₾${(company.modulePrices[module] ?? 0).toFixed(2)}`,
    );
    return parts.length ? `${parts.join(', ')} per month` : 'HR only';
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

  private async paidUntil(companyId: string): Promise<string | null> {
    const row = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('MAX(payment.period_to)', 'paidUntil')
      .where('payment.company_id = :companyId', { companyId })
      .getRawOne<{ paidUntil: string | Date | null }>();
    const value = row?.paidUntil ?? null;
    return value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }

  private async toView(company: Company): Promise<CompanyView> {
    const admin = await this.usersRepository.findOneBy({
      companyId: company.id,
      role: UserRole.SYSTEM_ADMIN,
    });
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      legalForm: company.legalForm,
      identificationCode: company.identificationCode,
      modules: company.modules,
      modulePrices: company.modulePrices,
      status: company.status,
      subscriptionStart: company.subscriptionStart,
      trialEndsOn: company.trialEndsOn,
      billing: billingOf(company, await this.paidUntil(company.id)),
      createdAt: company.createdAt,
      adminName: admin?.displayName ?? null,
      adminUsername: admin?.username ?? null,
      employeeCount: await this.employeesRepository.countBy({
        companyId: company.id,
      }),
    };
  }

  private async toDetail(company: Company): Promise<CompanyDetail> {
    const payments = await this.paymentsRepository.find({
      where: { companyId: company.id },
      order: { periodTo: 'DESC', paidOn: 'DESC' },
    });
    return {
      ...(await this.toView(company)),
      vatPayer: company.vatPayer,
      legalAddress: company.legalAddress,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      notes: company.notes,
      updatedAt: company.updatedAt,
      payments,
      totalPaid: Math.round(payments.reduce((sum, p) => sum + p.amount * 100, 0)) / 100,
    };
  }
}
