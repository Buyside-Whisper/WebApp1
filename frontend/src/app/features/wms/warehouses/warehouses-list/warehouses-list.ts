import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Download, LucideAngularModule, Package, PenLine, Plus, Search, Trash2, Upload } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { ColumnOrder } from '../../../../shared/column-order/column-order';
import { Modal } from '../../../../shared/modal/modal';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { XlsxImport } from '../../../../shared/xlsx-import/xlsx-import';
import { PreviewColumn, saveFile, today } from '../../../../shared/xlsx-import/xlsx-import.model';
import {
  ManagerOption,
  Warehouse,
  WarehousePreviewRow,
  WarehouseStatus,
  WarehouseType,
} from '../warehouse.model';
import { WarehouseService } from '../warehouse.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';

@Component({
  selector: 'app-warehouses-list',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, Modal, Pager, XlsxImport],
  templateUrl: './warehouses-list.html',
  styleUrl: './warehouses-list.css',
})
export class WarehousesList implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly warehouseService = inject(WarehouseService);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });
  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly managerOptions = signal<ManagerOption[]>([]);

  protected readonly ViewIcon = Package;
  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly ImportIcon = Upload;
  protected readonly ExportIcon = Download;

  protected readonly columnOrder = new ColumnOrder('wms-warehouses', [
    { key: 'name', label: 'Warehouse' },
    { key: 'code', label: 'Code' },
    { key: 'branch', label: 'Branch' },
    { key: 'type', label: 'Type' },
    { key: 'address', label: 'Address' },
    { key: 'manager', label: 'Manager' },
    { key: 'products', label: 'Products' },
    { key: 'stock', label: 'Stock' },
    { key: 'totalPrice', label: 'Total price' },
    { key: 'status', label: 'Status' },
  ]);

  protected readonly warehouses = signal<Warehouse[]>([]);

  protected readonly search = signal('');
  protected readonly typeFilter = signal<'all' | WarehouseType>('all');
  protected readonly statusFilter = signal<'all' | WarehouseStatus>('all');
  protected readonly managerFilter = signal('all');
  protected readonly stockFilter = signal<'all' | 'stocked' | 'empty'>('all');

  protected readonly managersInList = computed(() => {
    const byId = new Map<string, string>();
    for (const { manager } of this.warehouses()) {
      if (manager) {
        byId.set(manager.id, `${manager.firstName} ${manager.lastName}`);
      }
    }
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly hasFilters = computed(
    () =>
      this.search().trim() !== '' ||
      this.typeFilter() !== 'all' ||
      this.statusFilter() !== 'all' ||
      this.managerFilter() !== 'all' ||
      this.stockFilter() !== 'all',
  );

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const status = this.statusFilter();
    const manager = this.managerFilter();
    const stock = this.stockFilter();
    return this.warehouses().filter(
      (w) =>
        (type === 'all' || w.type === type) &&
        (status === 'all' || w.status === status) &&
        (manager === 'all' || (manager === 'none' ? !w.managerId : w.managerId === manager)) &&
        (stock === 'all' || (stock === 'empty') === (w.productCount === 0)) &&
        (!query ||
          [w.name, w.code, w.address, w.branch ?? '', w.manager ? `${w.manager.firstName} ${w.manager.lastName}` : '']
            .some((value) => value.toLowerCase().includes(query))),
    );
  });

  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.typeFilter(), this.statusFilter(), this.managerFilter(), this.stockFilter()],
  );

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set('all');
    this.statusFilter.set('all');
    this.managerFilter.set('all');
    this.stockFilter.set('all');
  }
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly isFormOpen = signal(false);
  protected readonly isImportOpen = signal(false);
  protected readonly isExporting = signal(false);

  protected readonly importColumns: PreviewColumn<WarehousePreviewRow>[] = [
    { label: 'Warehouse', value: (row) => row.name, strong: true },
    { label: 'Type', value: (row) => (row.type === 'main' ? 'Main' : 'Sales') },
    { label: 'Branch', value: (row) => row.branch ?? 'All branches' },
    { label: 'Address', value: (row) => row.address },
    { label: 'Manager', value: (row) => row.manager ?? '—' },
    { label: 'Status', value: (row) => (row.status === 'active' ? 'Active' : 'Inactive') },
  ];
  protected readonly formError = signal('');

  protected readonly editingId = signal<string | null>(null);

  protected readonly name = signal('');
  protected readonly type = signal<WarehouseType>('sales');
  protected readonly branch = signal('');
  protected readonly address = signal('');
  protected readonly status = signal<WarehouseStatus>('active');
  protected readonly managerId = signal('');

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
      this.formError.set('Warehouse name and address are required.');
      return;
    }
    if (this.type() === 'sales' && !this.branch().trim()) {
      this.formError.set('A sales warehouse needs a branch.');
      return;
    }

    const payload = {
      name: this.name().trim(),
      type: this.type(),
      branch: this.type() === 'sales' ? this.branch().trim() : null,
      address: this.address().trim(),
      status: this.status(),
      managerId: this.managerId() || null,
    };

    const id = this.editingId();
    const request = id
      ? this.warehouseService.update(id, payload)
      : this.warehouseService.create(payload);

    this.isSaving.set(true);
    this.formError.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeForm();
        this.loadWarehouses();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.formError.set(typeof message === 'string' ? message : 'Could not save the warehouse.');
      },
    });
  }

  exportWarehouses(): void {
    this.isExporting.set(true);
    this.warehouseService.export().subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        saveFile(blob, `warehouses-${today()}.xlsx`);
      },
      error: () => {
        this.isExporting.set(false);
        this.errorMessage.set('Could not export the warehouses. Is the backend running?');
      },
    });
  }

  editWarehouse(warehouse: Warehouse): void {
    this.editingId.set(warehouse.id);
    this.name.set(warehouse.name);
    this.type.set(warehouse.type);
    this.branch.set(warehouse.branch ?? '');
    this.address.set(warehouse.address);
    this.status.set(warehouse.status);
    this.managerId.set(warehouse.managerId ?? '');
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  openAddForm(): void {
    this.resetForm();
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.resetForm();
  }

  deleteWarehouse(warehouse: Warehouse): void {
    if (!this.i18n.confirm(this.i18n.t('Delete {code} {name}?', { code: warehouse.code, name: warehouse.name }))) {
      return;
    }

    this.warehouseService.remove(warehouse.id).subscribe({
      next: () => {
        this.loadWarehouses();
      },
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the warehouse.'),
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.type.set('sales');
    this.branch.set('');
    this.address.set('');
    this.status.set('active');
    this.managerId.set('');
    this.formError.set('');
  }
}
