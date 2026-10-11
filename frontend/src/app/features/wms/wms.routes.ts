import { Routes } from '@angular/router';
import { accessGuard } from '../../core/auth/auth.guards';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'warehouses' },
  {
    path: 'warehouses',
    loadComponent: () =>
      import('./warehouses/warehouses-list/warehouses-list').then((m) => m.WarehousesList),
  },
  {
    path: 'products',
    canActivate: [accessGuard('wms', ['system_admin', 'module_admin'])],
    loadComponent: () =>
      import('./products/products-list/products-list').then((m) => m.ProductsList),
  },
] satisfies Routes;
