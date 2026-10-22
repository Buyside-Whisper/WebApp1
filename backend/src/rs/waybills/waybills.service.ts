import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { decryptSecret, encryptSecret } from '../../common/secret-box.js';
import { RsClient, RsCredentials, RsWaybillDetail, RsWaybillSummary } from './rs-client.js';
import { RsConnection } from './rs-connection.entity.js';
import { RsPeriodQueryDto, SaveRsConnectionDto } from './dto/rs.dto.js';

export interface RsConnectionView {
  connected: boolean;
  username: string | null;
  rsUnId: number | null;
  checkedAt: Date | null;
  checkOk: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
}

const MAX_PERIOD_DAYS = 92;
const LIST_CACHE_MS = 5 * 60 * 1000;
const LIST_CACHE_SIZE = 50;

export interface RsWaybillList {
  waybills: RsWaybillSummary[];
  fetchedAt: Date;
}

@Injectable()
export class RsWaybillsService {
  constructor(
    @InjectRepository(RsConnection)
    private readonly connectionsRepository: Repository<RsConnection>,
    private readonly client: RsClient,
    private readonly audit: AuditService,
  ) {}

  private readonly listCache = new Map<string, RsWaybillList>();

  async connection(actor: AuthUser): Promise<RsConnectionView> {
    return this.toView(await this.findConnection(actor));
  }

  async saveConnection(actor: AuthUser, dto: SaveRsConnectionDto): Promise<RsConnectionView> {
    const check = await this.client.checkServiceUser({ username: dto.username, password: dto.password });
    if (!check.ok) {
      throw new BadRequestException(
        'RS did not accept this service user and password. Check both exactly (a trailing dot or space counts) and that the service user allows this server\'s IP address.',
      );
    }
    const existing = await this.findConnection(actor);
    const connection = existing ?? this.connectionsRepository.create({ companyId: actor.companyId! });
    Object.assign(connection, {
      username: dto.username,
      passwordEncrypted: encryptSecret(dto.password),
      rsUnId: check.unId,
      rsUserId: check.userId,
      checkedAt: new Date(),
      checkOk: true,
      updatedBy: actor.displayName,
    });
    const saved = await this.connectionsRepository.save(connection);
    this.forgetLists(actor);
    await this.audit.record(actor, 'rs.connect', `Connected RS service user ${dto.username}`);
    return this.toView(saved);
  }

  async check(actor: AuthUser): Promise<RsConnectionView> {
    const connection = await this.requireConnection(actor);
    const check = await this.client.checkServiceUser(this.credentials(connection));
    connection.checkedAt = new Date();
    connection.checkOk = check.ok;
    if (check.ok) {
      connection.rsUnId = check.unId;
      connection.rsUserId = check.userId;
    }
    return this.toView(await this.connectionsRepository.save(connection));
  }

  async disconnect(actor: AuthUser): Promise<void> {
    const connection = await this.requireConnection(actor);
    await this.connectionsRepository.remove(connection);
    this.forgetLists(actor);
    await this.audit.record(actor, 'rs.disconnect', `Removed RS service user ${connection.username}`);
  }

  async receivedWaybills(actor: AuthUser, query: RsPeriodQueryDto): Promise<RsWaybillList> {
    if (query.to < query.from) {
      throw new BadRequestException('The period must end on or after the day it starts');
    }
    const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 + 1;
    if (days > MAX_PERIOD_DAYS) {
      throw new BadRequestException(`Choose a period of at most ${MAX_PERIOD_DAYS} days`);
    }
    const connection = await this.requireConnection(actor);
    const key = `${actor.companyId}:${connection.username}:${query.from}:${query.to}`;
    const cached = this.listCache.get(key);
    if (cached && !query.refresh && Date.now() - cached.fetchedAt.getTime() < LIST_CACHE_MS) {
      return cached;
    }
    const waybills = await this.client.buyerWaybills(this.credentials(connection), query.from, query.to);
    const list = {
      waybills: waybills.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      fetchedAt: new Date(),
    };
    this.listCache.delete(key);
    this.listCache.set(key, list);
    if (this.listCache.size > LIST_CACHE_SIZE) {
      this.listCache.delete(this.listCache.keys().next().value!);
    }
    return list;
  }

  async waybill(actor: AuthUser, id: string): Promise<RsWaybillDetail> {
    if (!/^\d{1,15}$/.test(id)) {
      throw new NotFoundException(`Waybill ${id} not found`);
    }
    const connection = await this.requireConnection(actor);
    return this.client.waybill(this.credentials(connection), id);
  }

  async companyCredentials(actor: AuthUser): Promise<RsCredentials> {
    return this.credentials(await this.requireConnection(actor));
  }

  forgetLists(actor: AuthUser): void {
    for (const key of [...this.listCache.keys()]) {
      if (key.startsWith(`${actor.companyId}:`)) {
        this.listCache.delete(key);
      }
    }
  }

  private findConnection(actor: AuthUser): Promise<RsConnection | null> {
    return this.connectionsRepository.findOneBy({ companyId: actor.companyId! });
  }

  private async requireConnection(actor: AuthUser): Promise<RsConnection> {
    const connection = await this.findConnection(actor);
    if (!connection) {
      throw new BadRequestException('RS is not connected yet. The system admin adds the RS service user under RS → RS waybills → RS connection.');
    }
    return connection;
  }

  private credentials(connection: RsConnection): RsCredentials {
    return { username: connection.username, password: decryptSecret(connection.passwordEncrypted) };
  }

  private toView(connection: RsConnection | null): RsConnectionView {
    return {
      connected: !!connection,
      username: connection?.username ?? null,
      rsUnId: connection?.rsUnId ?? null,
      checkedAt: connection?.checkedAt ?? null,
      checkOk: connection?.checkOk ?? false,
      updatedBy: connection?.updatedBy ?? null,
      updatedAt: connection?.updatedAt ?? null,
    };
  }
}
