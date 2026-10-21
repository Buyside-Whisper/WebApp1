import { Routes } from '@angular/router';
import { accessGuard } from '../../core/auth/auth.guards';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'cash-register' },
  {
    path: 'stores',
    canActivate: [accessGuard('store', ['system_admin', 'module_admin', 'manager'])],
    loadComponent: () => import('./stores/stores-list/stores-list').then((m) => m.StoresList),
  },
  {
    path: 'cash-register',
    loadComponent: () =>
      import('./cash-register/cash-register-page/cash-register-page').then(
        (m) => m.CashRegisterPage,
      ),
  },
  {
    path: 'pos',
    canActivate: [accessGuard('store', ['manager', 'cashier'])],
    loadComponent: () => import('./pos/pos-page/pos-page').then((m) => m.PosPage),
  },
  {
    path: 'record-expense',
    loadComponent: () =>
      import('./record-expense/record-expense-page/record-expense-page').then(
        (m) => m.RecordExpensePage,
      ),
  },
] satisfies Routes;
