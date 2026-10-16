export type Role = 'superuser' | 'system_admin' | 'module_admin' | 'manager' | 'cashier';
export type AppModule = 'wms' | 'store' | 'restaurant';
export type AccessModule = 'hr' | AppModule;

export interface SessionUser {
  username: string;
  displayName: string;
  role: Role;
  module: AppModule | null;
  companyName: string | null;
  companyModules: AppModule[];
}

export interface Session {
  token: string;
  user: SessionUser;
}

// A login handed out once (new employee login, new company, password reset).
export interface Credentials {
  displayName: string;
  username: string;
  password: string;
}

export const MODULE_LABELS: Record<AppModule, string> = {
  wms: 'WMS',
  store: 'Store',
  restaurant: 'Restaurant',
};

export const ROLE_LABELS: Record<Role, string> = {
  superuser: 'Superuser',
  system_admin: 'System admin',
  module_admin: 'Module admin',
  manager: 'Manager',
  cashier: 'Cashier',
};
