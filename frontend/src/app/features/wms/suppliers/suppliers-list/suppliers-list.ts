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
import { SupplierService } from '../supplier.service';

@Component({
  selector: 'app-suppliers-list',
  imports: [FormsModule, LucideAngularModule, Modal, Pager, ProductTabs],
  templateUrl: './suppliers-list.html',
})
export class SuppliersList implements OnInit {
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
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly type = signal<SupplierType>('company');
  protected readonly identificationCode = signal('');
  protected readonly vatPayer = signal(false);
  protected readonly contactPerson = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly address = signal('');
  protected readonly status = signal<SupplierStatus>('active');

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
    this.fillForm(null);
    this.isFormOpen.set(true);
  }

  editSupplier(supplier: Supplier): void {
    this.fillForm(supplier);
    this.isFormOpen.set(true);
  }

  saveSupplier(): void {
    const code = this.identificationCode().trim();
    if (!this.name().trim()) {
      this.formError.set('The supplier name is required.');
      return;
    }
    const length = this.type() === 'company' ? 9 : 11;
    if (code && !new RegExp(`^\\d{${length}}$`).test(code)) {
      this.formError.set(
        this.type() === 'company'
          ? "A company's identification code has 9 digits."
          : "An individual's identification code is the 11-digit personal ID.",
      );
      return;
    }
    const payload = {
      name: this.name().trim(),
      type: this.type(),
      identificationCode: code || null,
      vatPayer: this.vatPayer(),
      contactPerson: this.contactPerson().trim() || null,
      phone: this.phone().trim() || null,
      email: this.email().trim() || null,
      address: this.address().trim() || null,
      status: this.status(),
    };
    const id = this.editingId();
    const request = id ? this.supplierService.update(id, payload) : this.supplierService.create(payload);
    this.isSaving.set(true);
    this.formError.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.loadSuppliers();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.formError.set(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Could not save the supplier.',
        );
      },
    });
  }

  deleteSupplier(supplier: Supplier): void {
    if (!confirm(`Delete the supplier ${supplier.name}?`)) {
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

  private fillForm(supplier: Supplier | null): void {
    this.editingId.set(supplier?.id ?? null);
    this.name.set(supplier?.name ?? '');
    this.type.set(supplier?.type ?? 'company');
    this.identificationCode.set(supplier?.identificationCode ?? '');
    this.vatPayer.set(supplier?.vatPayer ?? false);
    this.contactPerson.set(supplier?.contactPerson ?? '');
    this.phone.set(supplier?.phone ?? '');
    this.email.set(supplier?.email ?? '');
    this.address.set(supplier?.address ?? '');
    this.status.set(supplier?.status ?? 'active');
    this.formError.set('');
  }
}
