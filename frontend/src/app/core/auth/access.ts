import { AccessModule, Role, SessionUser } from './auth.model';

export const ADMIN_ROLES: Role[] = ['system_admin', 'module_admin'];

export function canAccessModule(user: SessionUser | null, module: AccessModule): boolean {
  if (!user || user.role === 'superuser') {
    return false;
  }
  if (module === 'rs') {
    return user.role === 'system_admin' || user.role === 'module_admin';
  }
  if (module !== 'hr' && !user.companyModules.includes(module)) {
    return false;
  }
  switch (user.role) {
    case 'system_admin':
      return true;
    case 'module_admin':
      return module === 'hr' || user.module === module;
    case 'manager':
      return module === 'hr' ? user.module === 'store' || user.module === 'wms' : user.module === module;
    default:
      return module !== 'hr' && user.module === module;
  }
}

export function landingUrl(user: SessionUser): string {
  switch (user.role) {
    case 'superuser':
      return '/superadmin/companies';
    case 'system_admin':
      return '/hr/employees';
    case 'cashier':
      return '/store/pos';
    default:
      break;
  }
  switch (user.module) {
    case 'wms':
      return '/wms/warehouses';
    case 'store':
      return user.role === 'manager' ? '/store/stores' : '/store/cash-register';
    case 'restaurant':
      return '/restaurant/table-service';
    default:
      return '/login';
  }
}
