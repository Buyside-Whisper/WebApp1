import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { NotFoundPage } from './layout/not-found/not-found-page';
import { SuperadminShell } from './layout/superadmin-shell/superadmin-shell';
import {
  accessGuard,
  companyUserGuard,
  landingGuard,
  superuserGuard,
} from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'superadmin/login',
    loadComponent: () =>
      import('./features/superadmin/superadmin-login-page/superadmin-login-page').then(
        (m) => m.SuperadminLoginPage,
      ),
  },
  {
    path: 'superadmin',
    component: SuperadminShell,
    canActivate: [superuserGuard],
    loadChildren: () => import('./features/superadmin/superadmin.routes'),
  },

  {
    path: '',
    component: Shell,
    canActivate: [companyUserGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },
      {
        path: 'hr',
        canActivate: [accessGuard('hr')],
        loadChildren: () => import('./features/hr/hr.routes'),
      },
      {
        path: 'wms',
        canActivate: [accessGuard('wms')],
        loadChildren: () => import('./features/wms/wms.routes'),
      },
      {
        path: 'store',
        canActivate: [accessGuard('store')],
        loadChildren: () => import('./features/store/store.routes'),
      },
      {
        path: 'restaurant',
        canActivate: [accessGuard('restaurant')],
        loadChildren: () => import('./features/restaurant/restaurant.routes'),
      },
      { path: '**', component: NotFoundPage },
    ],
  },
];
