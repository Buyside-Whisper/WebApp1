import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { Warehouse } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { Product, ProductUnit } from '../product.model';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-products-list',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './products-list.html',
  styleUrl: './products-list.css',
})
export class ProductsList implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly auth = inject(AuthService);

  // Only the WMS admin changes products; the system admin sees them read-only.
  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');

  protected readonly products = signal<Product[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly editingId = signal<string | null>(null);

  protected readonly name = signal('');
  protected readonly sku = signal('');
  protected readonly category = signal('');
  protected readonly supplier = signal('');
  protected readonly amount = signal(0);
  protected readonly unit = signal<ProductUnit>('pcs');
  protected readonly warehouseIds = signal<string[]>([]);

  protected readonly categories = computed(() =>
    this.uniqueSorted(this.products().map((p) => p.category)),
  );
  protected readonly suppliers = computed(() =>
    this.uniqueSorted(this.products().map((p) => p.supplier)),
  );

  ngOnInit(): void {
    this.loadProducts();
    if (!this.canManage()) {
      return; // the warehouse checkboxes are only needed by the form
    }
    this.warehouseService.list().subscribe({
      next: (warehouses) => this.warehouses.set(warehouses),
      error: () => this.errorMessage.set('Could not load warehouses. Is the backend running?'),
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.productService.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load products. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  isWarehouseSelected(id: string): boolean {
    return this.warehouseIds().includes(id);
  }

  toggleWarehouse(id: string): void {
    this.warehouseIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  saveProduct(): void {
    const fields = [this.name(), this.sku(), this.category(), this.supplier()];
    if (fields.some((value) => !value.trim())) {
      this.errorMessage.set('Product, SKU, category and supplier are required.');
      return;
    }

    const amount = Number(this.amount()) || 0;
    if (amount < 0) {
      this.errorMessage.set('Amount cannot be negative.');
      return;
    }
    if (this.unit() === 'pcs' && !Number.isInteger(amount)) {
      this.errorMessage.set('Amount must be a whole number when the unit is pcs.');
      return;
    }

    const payload = {
      name: this.name().trim(),
      sku: this.sku().trim(),
      category: this.category().trim(),
      supplier: this.supplier().trim(),
      amount,
      unit: this.unit(),
      warehouseIds: this.warehouseIds(),
    };

    const id = this.editingId();
    const request = id
      ? this.productService.update(id, payload)
      : this.productService.create(payload);

    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.resetForm();
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.errorMessage.set(
          typeof message === 'string' ? message : 'Could not save the product.',
        );
      },
    });
  }

  editProduct(product: Product): void {
    this.editingId.set(product.id);
    this.name.set(product.name);
    this.sku.set(product.sku);
    this.category.set(product.category);
    this.supplier.set(product.supplier);
    this.amount.set(product.amount);
    this.unit.set(product.unit);
    this.warehouseIds.set(product.warehouses.map((w) => w.id));
    this.errorMessage.set('');
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete ${product.sku} ${product.name}?`)) {
      return;
    }

    this.productService.remove(product.id).subscribe({
      next: () => {
        if (this.editingId() === product.id) {
          this.resetForm();
        }
        this.loadProducts();
      },
      error: () => this.errorMessage.set('Could not delete the product.'),
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.sku.set('');
    this.category.set('');
    this.supplier.set('');
    this.amount.set(0);
    this.unit.set('pcs');
    this.warehouseIds.set([]);
    this.errorMessage.set('');
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
}
