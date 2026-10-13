import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { ManagerOption, Warehouse, WarehouseStatus, WarehouseType } from '../warehouse.model';
import { WarehouseService } from '../warehouse.service';

@Component({
  selector: 'app-warehouses-list',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './warehouses-list.html',
  styleUrl: './warehouses-list.css',
})
export class WarehousesList implements OnInit {
  private readonly warehouseService = inject(WarehouseService);
  private readonly auth = inject(AuthService);

  // Admins see every warehouse; only the WMS admin may change them. The system admin sees all of
  // them read-only, a manager only the ones assigned to him (read-only).
  protected readonly isAdmin = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });
  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly managerOptions = signal<ManagerOption[]>([]);

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  // null = adding a new warehouse, otherwise the id of the one being edited
  protected readonly editingId = signal<string | null>(null);

  protected readonly name = signal('');
  protected readonly type = signal<WarehouseType>('sales');
  protected readonly branches = signal(''); // comma-separated in the form
  protected readonly address = signal('');
  protected readonly stock = signal(0);
  protected readonly status = signal<WarehouseStatus>('active');
  protected readonly managerId = signal(''); // '' = no manager

  ngOnInit(): void {
    this.loadWarehouses();
    if (this.canManage()) {
      this.warehouseService.managerOptions().subscribe((options) => this.managerOptions.set(options));
    }
  }

  loadWarehouses(): void {
    this.isLoading.set(true);
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load warehouses. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  saveWarehouse(): void {
    if (!this.name().trim() || !this.address().trim()) {
      this.errorMessage.set('Warehouse name and address are required.');
      return;
    }

    const payload = {
      name: this.name().trim(),
      type: this.type(),
      branches: this.branches()
        .split(',')
        .map((branch) => branch.trim())
        .filter(Boolean),
      address: this.address().trim(),
      stock: Math.max(0, Math.round(Number(this.stock()) || 0)),
      status: this.status(),
      managerId: this.managerId() || null,
    };

    const id = this.editingId();
    const request = id
      ? this.warehouseService.update(id, payload)
      : this.warehouseService.create(payload);

    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.resetForm();
        this.loadWarehouses();
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMessage.set('Could not save the warehouse.');
      },
    });
  }

  editWarehouse(warehouse: Warehouse): void {
    this.editingId.set(warehouse.id);
    this.name.set(warehouse.name);
    this.type.set(warehouse.type);
    this.branches.set(warehouse.branches.join(', '));
    this.address.set(warehouse.address);
    this.stock.set(warehouse.stock);
    this.status.set(warehouse.status);
    this.managerId.set(warehouse.managerId ?? '');
    this.errorMessage.set('');
  }

  deleteWarehouse(warehouse: Warehouse): void {
    if (!confirm(`Delete ${warehouse.code} ${warehouse.name}?`)) {
      return;
    }

    this.warehouseService.remove(warehouse.id).subscribe({
      next: () => {
        if (this.editingId() === warehouse.id) {
          this.resetForm();
        }
        this.loadWarehouses();
      },
      error: () => this.errorMessage.set('Could not delete the warehouse.'),
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.type.set('sales');
    this.branches.set('');
    this.address.set('');
    this.stock.set(0);
    this.status.set('active');
    this.managerId.set('');
  }
}
