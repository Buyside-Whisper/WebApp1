import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user.js';
import { UserRole } from '../auth/user-role.enum.js';
import { AuditLog } from './audit-log.entity.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(actor: AuthUser, action: string, summary: string, companyId?: string | null): Promise<void> {
    await this.auditRepository.save(
      this.auditRepository.create({
        companyId: companyId === undefined ? actor.companyId : companyId,
        actorName: actor.displayName,
        actorRole: actor.role,
        action,
        summary,
      }),
    );
  }

  find(actor: AuthUser, limit = 200): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: actor.role === UserRole.SUPERUSER ? {} : { companyId: actor.companyId! },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
