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
    path: 'warehouses/:id',
    loadComponent: () =>
      import('./warehouses/warehouse-view/warehouse-view').then((m) => m.WarehouseView),
  },
  {
    path: 'products',
    canActivate: [accessGuard('wms', ['system_admin', 'module_admin'])],
    loadComponent: () =>
      import('./products/products-list/products-list').then((m) => m.ProductsList),
  },
  {
    path: 'products/:id',
    canActivate: [accessGuard('wms', ['system_admin', 'module_admin'])],
    loadComponent: () =>
      import('./products/product-view/product-view').then((m) => m.ProductView),
  },
  // Stock documents: admins and WMS managers (the sidebar section is already WMS-only).
  {
    path: 'receipts',
    loadComponent: () => import('./receipts/receipts-list/receipts-list').then((m) => m.ReceiptsList),
  },
  {
    path: 'receipts/new',
    canActivate: [accessGuard('wms', ['module_admin', 'manager'])],
    loadComponent: () => import('./receipts/receipt-editor/receipt-editor').then((m) => m.ReceiptEditor),
  },
  {
    path: 'receipts/:id/edit',
    canActivate: [accessGuard('wms', ['module_admin', 'manager'])],
    loadComponent: () => import('./receipts/receipt-editor/receipt-editor').then((m) => m.ReceiptEditor),
  },
  {
    path: 'receipts/:id',
    loadComponent: () => import('./receipts/receipt-view/receipt-view').then((m) => m.ReceiptView),
  },
  {
    path: 'transfers',
    loadComponent: () => import('./transfers/transfers-list/transfers-list').then((m) => m.TransfersList),
  },
  {
    path: 'transfers/new',
    canActivate: [accessGuard('wms', ['module_admin', 'manager'])],
    loadComponent: () => import('./transfers/transfer-editor/transfer-editor').then((m) => m.TransferEditor),
  },
  {
    path: 'transfers/:id/edit',
    canActivate: [accessGuard('wms', ['module_admin', 'manager'])],
    loadComponent: () => import('./transfers/transfer-editor/transfer-editor').then((m) => m.TransferEditor),
  },
  {
    path: 'transfers/:id',
    loadComponent: () => import('./transfers/transfer-view/transfer-view').then((m) => m.TransferView),
  },
] satisfies Routes;
