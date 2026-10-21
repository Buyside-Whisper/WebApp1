import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { canAccessModule } from '../../core/auth/access';
import { MODULE_LABELS, ROLE_LABELS } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import {
  LucideAngularModule,
  Menu,
  ChevronDown,
  ChevronRight,
  Users,
  Boxes,
  Store,
  Utensils,
  LogOut,
} from 'lucide-angular';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly MenuIcon = Menu;
  protected readonly ChevronDownIcon = ChevronDown;
  protected readonly ChevronRightIcon = ChevronRight;
  protected readonly UsersIcon = Users;
  protected readonly BoxesIcon = Boxes;
  protected readonly StoreIcon = Store;
  protected readonly UtensilsIcon = Utensils;
  protected readonly LogOutIcon = LogOut;

  protected readonly isSidebarOpen = signal(true);
  protected readonly isHrExpanded = signal(true);
  protected readonly isWmsExpanded = signal(true);
  protected readonly isStoreExpanded = signal(true);
  protected readonly isRestaurantExpanded = signal(true);

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly showHr = computed(() => canAccessModule(this.user(), 'hr'));
  protected readonly showWms = computed(() => canAccessModule(this.user(), 'wms'));
  protected readonly showStore = computed(() => canAccessModule(this.user(), 'store'));
  protected readonly showRestaurant = computed(() => canAccessModule(this.user(), 'restaurant'));
  protected readonly isSystemAdmin = computed(() => this.user()?.role === 'system_admin');
  protected readonly isAdmin = computed(
    () => this.user()?.role === 'system_admin' || this.user()?.role === 'module_admin',
  );
  protected readonly isManager = computed(() => this.user()?.role === 'manager');
  protected readonly worksARegister = computed(
    () => this.user()?.role === 'manager' || this.user()?.role === 'cashier',
  );
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    if (!user) {
      return '';
    }
    return user.module && user.role !== 'system_admin'
      ? `${MODULE_LABELS[user.module]} ${ROLE_LABELS[user.role].toLowerCase()}`
      : ROLE_LABELS[user.role];
  });
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isHrActive = computed(() => this.currentUrl().startsWith('/hr'));
  protected readonly isWmsActive = computed(() => this.currentUrl().startsWith('/wms'));
  protected readonly isStoreActive = computed(() => this.currentUrl().startsWith('/store'));
  protected readonly isRestaurantActive = computed(() =>
    this.currentUrl().startsWith('/restaurant'),
  );

  toggleSidebar(): void {
    this.isSidebarOpen.update((value) => !value);
  }

  toggleHrMenu(): void {
    if (!this.isSidebarOpen()) {
      this.isSidebarOpen.set(true);
      this.isHrExpanded.set(true);
      return;
    }

    this.isHrExpanded.update((value) => !value);
  }

  toggleWmsMenu(): void {
    if (!this.isSidebarOpen()) {
      this.isSidebarOpen.set(true);
      this.isWmsExpanded.set(true);
      return;
    }

    this.isWmsExpanded.update((value) => !value);
  }

  toggleStoreMenu(): void {
    if (!this.isSidebarOpen()) {
      this.isSidebarOpen.set(true);
      this.isStoreExpanded.set(true);
      return;
    }

    this.isStoreExpanded.update((value) => !value);
  }

  toggleRestaurantMenu(): void {
    if (!this.isSidebarOpen()) {
      this.isSidebarOpen.set(true);
      this.isRestaurantExpanded.set(true);
      return;
    }

    this.isRestaurantExpanded.update((value) => !value);
  }

  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update((c) => c + 1);
  }
}
