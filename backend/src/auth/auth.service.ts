import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { AuthUser, SessionUser, toSessionUser } from './auth-user.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken, verifyToken } from './token.js';
import { CompanyStatus } from '../companies/company-status.enum.js';
import { UserRole } from './user-role.enum.js';
import { User } from './user.entity.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (await this.usersRepository.existsBy({ role: UserRole.SUPERUSER })) {
      return;
    }
    const username =
      this.config.get<string>('SUPERUSER_USERNAME') ?? 'superuser';
    const password =
      this.config.get<string>('SUPERUSER_PASSWORD') ?? 'superuser';
    await this.usersRepository.save(
      this.usersRepository.create({
        username,
        passwordHash: hashPassword(password),
        displayName: 'Superuser',
        role: UserRole.SUPERUSER,
        module: null,
        companyId: null,
        employeeId: null,
      }),
    );
    this.logger.log(
      `Created the superuser "${username}" (set SUPERUSER_PASSWORD in .env to change the password)`,
    );
  }

  async login(
    username: string,
    password: string,
    superuser: boolean,
  ): Promise<{ token: string; user: SessionUser }> {
    const user = await this.usersRepository.findOne({
      where: { username: username.trim() },
      relations: { company: true, employee: true },
    });
    const passwordOk = !!user && verifyPassword(password, user.passwordHash);
    const authUser = user && passwordOk ? this.toAuthUser(user) : null;

    if (
      !user ||
      !passwordOk ||
      (user.role === UserRole.SUPERUSER) !== superuser
    ) {
      throw new UnauthorizedException('Wrong username or password');
    }
    if (user.company && user.company.status !== CompanyStatus.ACTIVE) {
      throw new UnauthorizedException(
        `${user.company.name}'s access is ${user.company.status === CompanyStatus.SUSPENDED ? 'suspended' : 'cancelled'}. Please contact the app provider.`,
      );
    }
    if (!authUser) {
      throw new UnauthorizedException('Wrong username or password');
    }

    await this.audit.record(
      authUser,
      'auth.login',
      `${authUser.displayName} logged in`,
    );
    return { token: signToken(user.id), user: toSessionUser(authUser) };
  }

  async authenticate(token: string): Promise<AuthUser | null> {
    const userId = verifyToken(token);
    if (!userId) {
      return null;
    }
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { company: true, employee: true },
    });
    return user ? this.toAuthUser(user) : null;
  }

  private toAuthUser(user: User): AuthUser | null {
    const today = new Date().toISOString().slice(0, 10);
    if (user.company && user.company.status !== CompanyStatus.ACTIVE) {
      return null;
    }
    if (user.employee?.endDate && user.employee.endDate <= today) {
      return null;
    }
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      module: user.module,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyModules: user.company?.modules ?? [],
      employeeId: user.employeeId,
    };
  }
}
