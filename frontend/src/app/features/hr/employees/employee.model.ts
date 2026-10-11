import { AppModule } from '../../../core/auth/auth.model';

export type EmployeeRole = 'admin' | 'manager' | 'cashier';

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: 'Module admin',
  manager: 'Manager',
  cashier: 'Cashier',
};

export type EmployeeStatus = 'active' | 'former';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string | null;
  email: string | null;
  phone: string | null;
  branch: string | null;
  birthDate: string | null;
  hireDate: string | null;
  position: string | null;
  endDate: string | null;
  role: EmployeeRole | null;
  module: AppModule | null;
  username: string | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  personalId: string;
  email: string;
  phone: string;
  branch: string;
  birthDate: string;
  hireDate: string;
  position: string;
  endDate: string | null;
  role: EmployeeRole | null;
  module: AppModule | null;
  workplaceIds?: string[];
}
