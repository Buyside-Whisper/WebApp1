import { Routes } from '@angular/router';
import { accessGuard } from '../../core/auth/auth.guards';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'employees' },
  {
    path: 'employees',
    loadComponent: () =>
      import('./employees/employees-list/employees-list').then((m) => m.EmployeesList),
  },
  {
    path: 'audit',
    data: { eyebrow: 'HR' },
    canActivate: [accessGuard('hr', ['system_admin'])],
    loadComponent: () => import('../../shared/audit-log/audit-log-page').then((m) => m.AuditLogPage),
  },
] satisfies Routes;
