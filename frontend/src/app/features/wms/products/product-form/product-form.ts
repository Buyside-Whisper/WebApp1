import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Category } from '../../categories/category.model';
import { CategoryService } from '../../categories/category.service';
import { Supplier } from '../../suppliers/supplier.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { Product, ProductPosStatus, ProductStatus, ProductUnit, ProductUsage } from '../product.model';
import { ProductService } from '../product.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-product-form',
  imports: [TranslatePipe, FormsModule],
  templateUrl: './product-form.html',
})
export class ProductForm implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly supplierService = inject(SupplierService);

  readonly product = input<Product | null>(null);
  readonly known = input<Pick<Product, 'category' | 'group'>[]>([]);
  readonly initial = input<Partial<Pick<Product, 'name' | 'barcode' | 'unit'>> | null>(null);
  readonly hint = input(
    "Quantities aren't typed in here: stock comes in and goes out through stock documents " +
      "(receipts, transfers, write-offs), and the product's View page shows where it is.",
  );
  readonly saved = output<Product>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly submitted = signal(false);

  protected readonly name = signal('');
  protected readonly barcode = signal('');
  protected readonly categoryId = signal('');
  protected readonly group = signal('');
  protected readonly supplierId = signal('');
  protected readonly allCategories = signal<Category[] | null>(null);
  protected readonly allSuppliers = signal<Supplier[] | null>(null);
  protected readonly status = signal<ProductStatus>('active');
  protected readonly usage = signal<ProductUsage>('sale');
  protected readonly posStatus = signal<ProductPosStatus>('storage');
  protected readonly unit = signal<ProductUnit>('pcs');
  protected readonly costPrice = signal(0);
  protected readonly salePrice = signal(0);
  protected readonly unitLocked = signal(false);

  protected readonly categories = computed(() =>
    this.choosable(this.allCategories(), this.product()?.categoryId),
  );
  protected readonly suppliers = computed(() =>
    this.choosable(this.allSuppliers(), this.product()?.supplierId),
  );
  protected readonly errors = computed(() => {
    const required = (value: string) => (value.trim() ? '' : 'This field is required.');
    const price = (value: number) => (Number(value) < 0 ? "The price can't be negative." : '');
    return {
      name: required(this.name()),
      barcode: required(this.barcode()),
      categoryId: required(this.categoryId()),
      group: required(this.group()),
      supplierId: required(this.supplierId()),
      costPrice: price(this.costPrice()),
      salePrice: price(this.salePrice()),
    };
  });
  protected readonly shownErrors = computed(() =>
    this.submitted() ? this.errors() : { name: '', barcode: '', categoryId: '', group: '', supplierId: '', costPrice: '', salePrice: '' },
  );

  protected readonly groups = computed(() => {
    const categoryId = this.categoryId();
    const inCategory = this.known().filter((p) => p.category.id === categoryId);
    return this.uniqueSorted((inCategory.length ? inCategory : this.known()).map((p) => p.group));
  });

  ngOnInit(): void {
    this.categoryService.list().subscribe({
      next: (categories) => this.allCategories.set(categories),
      error: () => this.formError.set('Could not load the categories.'),
    });
    this.supplierService.list().subscribe({
      next: (suppliers) => this.allSuppliers.set(suppliers),
      error: () => this.formError.set('Could not load the suppliers.'),
    });
    const product = this.product();
    if (!product) {
      const initial = this.initial();
      this.name.set(initial?.name ?? '');
      this.barcode.set(initial?.barcode ?? '');
      this.unit.set(initial?.unit ?? 'pcs');
      return;
    }
    this.name.set(product.name);
    this.barcode.set(product.barcode);
    this.categoryId.set(product.categoryId);
    this.group.set(product.group);
    this.supplierId.set(product.supplierId);
    this.status.set(product.status);
    this.usage.set(product.usage);
    this.posStatus.set(product.posStatus);
    this.unit.set(product.unit);
    this.costPrice.set(product.costPrice);
    this.salePrice.set(product.salePrice);
    this.unitLocked.set(product.stocks.some((stock) => stock.quantity !== 0));
  }

  save(): void {
    this.submitted.set(true);
    if (Object.values(this.errors()).some((message) => message)) {
      this.formError.set('');
      return;
    }
    const payload = {
      name: this.name().trim(),
      barcode: this.barcode().trim(),
      categoryId: this.categoryId(),
      group: this.group().trim(),
      supplierId: this.supplierId(),
      status: this.status(),
      usage: this.usage(),
      posStatus: this.posStatus(),
      unit: this.unit(),
      costPrice: Number(this.costPrice()) || 0,
      salePrice: Number(this.salePrice()) || 0,
    };

    const id = this.product()?.id;
    const request = id ? this.productService.update(id, payload) : this.productService.create(payload);
    this.isSaving.set(true);
    this.formError.set('');
    request.subscribe({
      next: (product) => {
        this.isSaving.set(false);
        this.saved.emit(product);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.formError.set(typeof message === 'string' ? message : 'Could not save the product.');
      },
    });
  }

  private choosable<T extends { id: string; name: string; status: string }>(
    items: T[] | null,
    currentId: string | undefined,
  ): { id: string; label: string }[] {
    return (items ?? [])
      .filter((item) => item.status === 'active' || item.id === currentId)
      .map((item) => ({ id: item.id, label: item.status === 'active' ? item.name : `${item.name} (inactive)` }));
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
}
