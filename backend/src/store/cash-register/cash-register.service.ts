import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { Store } from '../stores/store.entity.js';
import { RegisterSession } from './register-session.entity.js';
import { Sale } from './sale.entity.js';
import { CloseRegisterDto, OpenRegisterDto } from './dto/register.dto.js';

export interface SessionView {
  id: string;
  storeId: string;
  storeName: string;
  registerNo: number;
  cashierName: string;
  openedAt: Date;
  closedAt: Date | null;
  status: 'open' | 'closed';
  openingCash: number;
  closingCash: number | null;
  salesCount: number;
  total: number;
}

export interface SessionDetail extends SessionView {
  sales: Sale[];
}

@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(RegisterSession)
    private readonly sessionsRepository: Repository<RegisterSession>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<SessionView[]> {
    const sessions = await this.sessionsRepository.find({
      where: await this.visibleWhere(actor),
      relations: { store: true },
      order: { openedAt: 'DESC' },
      take: 100,
    });
    return this.withTotals(sessions);
  }

  async findOne(actor: AuthUser, id: string): Promise<SessionDetail> {
    const session = await this.sessionsRepository.findOne({
      where: { ...(await this.visibleWhere(actor)), id },
      relations: { store: true },
    });

    if (!session) {
      throw new NotFoundException(`Register session ${id} not found`);
    }

    const sales = await this.salesRepository.find({
      where: { sessionId: id },
      relations: { lines: true },
      order: { number: 'ASC' },
    });
    const [view] = await this.withTotals([session]);
    return { ...view, sales };
  }

  async current(actor: AuthUser): Promise<SessionView | null> {
    const session = await this.findOpenSession(actor);
    if (!session) {
      return null;
    }
    session.store = (await this.storesRepository.findOneByOrFail({ id: session.storeId }));
    return (await this.withTotals([session]))[0];
  }

  async registers(actor: AuthUser, storeId: string): Promise<{ no: number; inUseBy: string | null }[]> {
    const store = await this.storeIWorkIn(actor, storeId);
    const open = await this.sessionsRepository.find({ where: { storeId: store.id, closedAt: IsNull() } });
    return Array.from({ length: store.registers }, (_, index) => ({
      no: index + 1,
      inUseBy: open.find((session) => session.registerNo === index + 1)?.cashierName ?? null,
    }));
  }

  async open(actor: AuthUser, dto: OpenRegisterDto): Promise<SessionView> {
    if (await this.findOpenSession(actor)) {
      throw new BadRequestException('You already have a register open. Close it first.');
    }

    const store = await this.storeIWorkIn(actor, dto.storeId);
    if (dto.registerNo > store.registers) {
      throw new BadRequestException(`${store.name} has ${store.registers} register${store.registers === 1 ? '' : 's'}`);
    }
    const taken = await this.sessionsRepository.findOne({
      where: { storeId: store.id, registerNo: dto.registerNo, closedAt: IsNull() },
    });
    if (taken) {
      throw new ConflictException(`Register ${dto.registerNo} is already open (${taken.cashierName})`);
    }

    let session: RegisterSession;
    try {
      session = await this.sessionsRepository.save(
        this.sessionsRepository.create({
          companyId: actor.companyId!,
          storeId: store.id,
          cashierId: actor.employeeId,
          cashierName: actor.displayName,
          registerNo: dto.registerNo,
          openingCash: dto.openingCash,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Register ${dto.registerNo} was just opened by someone else`);
      }
      throw error;
    }
    session.store = store;
    await this.audit.record(actor, 'register.open', `${actor.displayName} opened register ${dto.registerNo} in ${store.name}`);
    return (await this.withTotals([session]))[0];
  }

  private async storeIWorkIn(actor: AuthUser, storeId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id: storeId, companyId: actor.companyId! },
      relations: { members: true },
    });
    const allowed =
      store &&
      (actor.role === UserRole.MANAGER
        ? store.managerId === actor.employeeId
        : store.members.some((member) => member.id === actor.employeeId));
    if (!store || !allowed) {
      throw new ForbiddenException('You do not work in that store');
    }
    return store;
  }

  async close(actor: AuthUser, id: string, dto: CloseRegisterDto): Promise<SessionView> {
    const session = await this.sessionsRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { store: true },
    });
    if (!session) {
      throw new NotFoundException(`Register session ${id} not found`);
    }
    if (session.closedAt) {
      throw new BadRequestException('This register is already closed');
    }
    if (session.cashierId !== actor.employeeId && session.store.managerId !== actor.employeeId) {
      throw new ForbiddenException('Only the cashier who opened this register or the store manager can close it');
    }

    session.closedAt = new Date();
    session.closingCash = dto.closingCash;
    await this.sessionsRepository.save(session);
    await this.audit.record(actor, 'register.close', `${actor.displayName} closed register ${session.registerNo} in ${session.store.name}`);
    return (await this.withTotals([session]))[0];
  }

  findOpenSession(actor: AuthUser): Promise<RegisterSession | null> {
    if (!actor.employeeId) {
      return Promise.resolve(null);
    }
    return this.sessionsRepository.findOne({
      where: { companyId: actor.companyId!, cashierId: actor.employeeId, closedAt: IsNull() },
    });
  }

  private async visibleWhere(actor: AuthUser): Promise<FindOptionsWhere<RegisterSession>> {
    const where: FindOptionsWhere<RegisterSession> = { companyId: actor.companyId! };

    if (actor.role === UserRole.CASHIER) {
      where.cashierId = actor.employeeId!;
    } else if (actor.role === UserRole.MANAGER) {
      const stores = await this.storesRepository.find({
        select: { id: true },
        where: { companyId: actor.companyId!, managerId: actor.employeeId! },
      });
      where.storeId = In(stores.map((store) => store.id));
    }
    return where;
  }

  private async withTotals(sessions: RegisterSession[]): Promise<SessionView[]> {
    const totals = new Map<string, { count: number; total: number }>();

    if (sessions.length > 0) {
      const rows = await this.salesRepository
        .createQueryBuilder('sale')
        .select('sale.session_id', 'sessionId')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(sale.total), 0)', 'total')
        .where('sale.session_id IN (:...ids)', { ids: sessions.map((s) => s.id) })
        .groupBy('sale.session_id')
        .getRawMany<{ sessionId: string; count: string; total: string }>();
      for (const row of rows) {
        totals.set(row.sessionId, { count: Number(row.count), total: Number(row.total) });
      }
    }

    return sessions.map((session) => ({
      id: session.id,
      storeId: session.storeId,
      storeName: session.store.name,
      registerNo: session.registerNo,
      cashierName: session.cashierName,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      status: session.closedAt ? 'closed' : 'open',
      openingCash: session.openingCash,
      closingCash: session.closingCash,
      salesCount: totals.get(session.id)?.count ?? 0,
      total: totals.get(session.id)?.total ?? 0,
    }));
  }
}
