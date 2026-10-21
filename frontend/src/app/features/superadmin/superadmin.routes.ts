import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'companies' },
  {
    path: 'companies',
    loadComponent: () =>
      import('./companies/companies-page/companies-page').then((m) => m.CompaniesPage),
  },
  {
    path: 'audit',
    data: { eyebrow: 'Platform' },
    loadComponent: () =>
      import('../../shared/audit-log/audit-log-page').then((m) => m.AuditLogPage),
  },
] satisfies Routes;
