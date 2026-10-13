import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { Store, StoreOptions } from '../store.model';
import { StoreService } from '../store.service';

@Component({
  selector: 'app-stores-list',
  imports: [FormsModule],
  templateUrl: './stores-list.html',
})
export class StoresList implements OnInit {
  private readonly storeService = inject(StoreService);
  private readonly auth = inject(AuthService);

  // Admins see every store; only the Store admin may change them. The system admin sees all of them
  // read-only, a manager only the ones he runs (read-only).
  protected readonly isAdmin = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });
  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly options = signal<StoreOptions>({ managers: [] });

  protected readonly stores = signal<Store[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  // null = adding a new store, otherwise the id of the one being edited
  protected readonly editingId = signal<string | null>(null);

  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly registers = signal(1);
  protected readonly managerId = signal(''); // '' = no manager

  ngOnInit(): void {
    this.load();
    if (this.canManage()) {
      this.storeService.options().subscribe((options) => this.options.set(options));
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.storeService.list().subscribe({
      next: (stores) => {
        this.stores.set(stores);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load stores. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  save(): void {
    if (!this.name().trim() || !this.address().trim()) {
      this.errorMessage.set('Store name and address are required.');
      return;
    }

    const payload = {
      name: this.name().trim(),
      address: this.address().trim(),
      registers: Math.min(50, Math.max(1, Math.round(Number(this.registers()) || 1))),
      managerId: this.managerId() || null,
    };
    const id = this.editingId();
    const request = id ? this.storeService.update(id, payload) : this.storeService.create(payload);

    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.resetForm();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.errorMessage.set(typeof message === 'string' ? message : 'Could not save the store.');
      },
    });
  }

  edit(store: Store): void {
    this.editingId.set(store.id);
    this.name.set(store.name);
    this.address.set(store.address);
    this.registers.set(store.registers);
    this.managerId.set(store.manager?.id ?? '');
    this.errorMessage.set('');
  }

  remove(store: Store): void {
    if (!confirm(`Delete ${store.name}? Its register history is deleted too.`)) {
      return;
    }
    this.storeService.remove(store.id).subscribe({
      next: () => {
        if (this.editingId() === store.id) {
          this.resetForm();
        }
        this.load();
      },
      error: () => this.errorMessage.set('Could not delete the store.'),
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.address.set('');
    this.registers.set(1);
    this.managerId.set('');
  }
}
