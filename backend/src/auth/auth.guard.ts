import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAccessModule } from './access.js';
import { AuthService } from './auth.service.js';
import { AuthUser } from './auth-user.js';
import { ACCESS_MODULE, AccessModule, IS_PUBLIC, ROLES } from './decorators.js';
import { UserRole } from './user-role.enum.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const header = request.headers.authorization ?? '';
    const user = await this.authService.authenticate(
      header.startsWith('Bearer ') ? header.slice(7) : '',
    );
    if (!user) {
      throw new UnauthorizedException('Please log in');
    }
    request.user = user;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES,
      targets,
    );
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Your role cannot do this');
    }

    const module = this.reflector.getAllAndOverride<AccessModule | undefined>(
      ACCESS_MODULE,
      targets,
    );
    if (module && !canAccessModule(user, module)) {
      throw new ForbiddenException(
        `You do not have access to ${module.toUpperCase()}`,
      );
    }

    return true;
  }
}
