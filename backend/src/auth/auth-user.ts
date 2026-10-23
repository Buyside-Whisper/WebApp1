import { AppModuleName } from '../companies/app-module.enum.js';
import { UserRole } from './user-role.enum.js';

export class AuthUser {
  userId!: string;
  username!: string;
  displayName!: string;
  role!: UserRole;
  module!: AppModuleName | null;
  companyId!: string | null;
  companyName!: string | null;
  companyModules!: AppModuleName[];
  employeeId!: string | null;
  language!: string;
}

export class SessionUser {
  username!: string;
  displayName!: string;
  role!: UserRole;
  module!: AppModuleName | null;
  companyName!: string | null;
  companyModules!: AppModuleName[];
  language!: string;
}

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    module: user.module,
    companyName: user.companyName,
    companyModules: user.companyModules,
    language: user.language,
  };
}
