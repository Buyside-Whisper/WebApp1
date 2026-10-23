import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, PenLine, Plus, Search, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { ProductTabs } from '../../products/product-tabs/product-tabs';
import { SUPPLIER_TYPE_LABELS, Supplier, SupplierStatus, SupplierType } from '../supplier.model';
import { SupplierForm } from '../supplier-form/supplier-form';
import { SupplierService } from '../supplier.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-suppliers-list',
  imports: [TranslatePipe, FormsModule, LucideAngularModule, Modal, Pager, ProductTabs, SupplierForm],
  templateUrl: './suppliers-list.html',
})
export class SuppliersList implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly supplierService = inject(SupplierService);
  private readonly auth = inject(AuthService);

  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly typeLabels = SUPPLIER_TYPE_LABELS;

  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly typeFilter = signal<'all' | SupplierType>('all');
  protected readonly vatFilter = signal<'all' | 'yes' | 'no'>('all');
  protected readonly statusFilter = signal<'all' | SupplierStatus>('all');
  protected readonly hasFilters = computed(
    () =>
      this.search().trim() !== '' ||
      this.typeFilter() !== 'all' ||
      this.vatFilter() !== 'all' ||
      this.statusFilter() !== 'all',
  );
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const vat = this.vatFilter();
    const status = this.statusFilter();
    return this.suppliers().filter(
      (s) =>
        (type === 'all' || s.type === type) &&
        (vat === 'all' || s.vatPayer === (vat === 'yes')) &&
        (status === 'all' || s.status === status) &&
        (!query ||
          [s.name, s.identificationCode, s.contactPerson, s.phone, s.email, s.address].some((value) =>
            (value ?? '').toLowerCase().includes(query),
          )),
    );
  });
  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.typeFilter(), this.vatFilter(), this.statusFilter()],
  );

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<Supplier | null>(null);

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.isLoading.set(true);
    this.supplierService.list().subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load suppliers. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set('all');
    this.vatFilter.set('all');
    this.statusFilter.set('all');
  }

  openAddForm(): void {
    this.editing.set(null);
    this.isFormOpen.set(true);
  }

  editSupplier(supplier: Supplier): void {
    this.editing.set(supplier);
    this.isFormOpen.set(true);
  }

  onSaved(): void {
    this.isFormOpen.set(false);
    this.loadSuppliers();
  }

  deleteSupplier(supplier: Supplier): void {
    if (!this.i18n.confirm(this.i18n.t('Delete the supplier {name}?', { name: supplier.name }))) {
      return;
    }
    this.errorMessage.set('');
    this.supplierService.remove(supplier.id).subscribe({
      next: () => this.loadSuppliers(),
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the supplier.'),
    });
  }

  protected deleteTitle(supplier: Supplier): string {
    if (!this.canManage()) {
      return 'Only the WMS admin can delete';
    }
    return supplier.productCount > 0 ? 'Has products: move them first, or set it to Inactive' : 'Delete';
  }
}
