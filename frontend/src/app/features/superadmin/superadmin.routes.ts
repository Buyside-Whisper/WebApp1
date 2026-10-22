import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'companies' },
  {
    path: 'companies',
    loadComponent: () =>
      import('./companies/companies-page/companies-page').then((m) => m.CompaniesPage),
  },
  {
    path: 'companies/new',
    loadComponent: () =>
      import('./companies/company-form/company-form').then((m) => m.CompanyForm),
  },
  {
    path: 'companies/:id/edit',
    loadComponent: () =>
      import('./companies/company-form/company-form').then((m) => m.CompanyForm),
  },
  {
    path: 'companies/:id',
    loadComponent: () =>
      import('./companies/company-view/company-view').then((m) => m.CompanyView),
  },
  {
    path: 'audit',
    data: { eyebrow: 'Platform' },
    loadComponent: () =>
      import('../../shared/audit-log/audit-log-page').then((m) => m.AuditLogPage),
  },
] satisfies Routes;
