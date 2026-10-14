export enum UserRole {
  SUPERUSER = 'superuser',
  SYSTEM_ADMIN = 'system_admin',
  MODULE_ADMIN = 'module_admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
}

export const ADMIN_ROLES = [UserRole.SYSTEM_ADMIN, UserRole.MODULE_ADMIN];
