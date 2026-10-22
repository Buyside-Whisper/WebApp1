import { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'waybills' },
  {
    path: 'waybills',
    loadComponent: () => import('./waybills/rs-waybills/rs-waybills').then((m) => m.RsWaybills),
  },
  {
    path: 'waybills/connection',
    loadComponent: () => import('./waybills/rs-connection/rs-connection').then((m) => m.RsConnection),
  },
] satisfies Routes;
