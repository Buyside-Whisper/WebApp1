import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Product, ProductPosStatus, ProductStatus, ProductUnit, ProductUsage } from '../product.model';
import { ProductService } from '../product.service';

// The Add / Edit product form (catalogue fields only). Used in a modal on the Products page and in
// the receipt editor's "New product". Put it inside an @if so it starts fresh each time it opens.
@Component({
  selector: 'app-product-form',
  imports: [FormsModule],
  templateUrl: './product-form.html',
})
export class ProductForm implements OnInit {
  private readonly productService = inject(ProductService);

  // The product to edit; null = a new one.
  readonly product = input<Product | null>(null);
  // Existing products, for the category / group / supplier suggestions.
  readonly known = input<Pick<Product, 'category' | 'group' | 'supplier'>[]>([]);
  readonly hint = input(
    "Quantities aren't typed in here: stock comes in and goes out through stock documents " +
      "(receipts, transfers, write-offs), and the product's View page shows where it is.",
  );
  readonly saved = output<Product>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  protected readonly name = signal('');
  protected readonly barcode = signal('');
  protected readonly category = signal('');
  protected readonly group = signal('');
  protected readonly supplier = signal('');
  protected readonly status = signal<ProductStatus>('active');
  protected readonly usage = signal<ProductUsage>('sale');
  protected readonly posStatus = signal<ProductPosStatus>('storage');
  protected readonly unit = signal<ProductUnit>('pcs');
  protected readonly costPrice = signal(0);
  protected readonly salePrice = signal(0);
  // The product being edited has stock, so its unit is fixed (the backend says the same).
  protected readonly unitLocked = signal(false);

  protected readonly categories = computed(() => this.uniqueSorted(this.known().map((p) => p.category)));
  // Suggest only the groups already used in the chosen category (all of them if it's new).
  protected readonly groups = computed(() => {
    const category = this.category().trim();
    const inCategory = this.known().filter((p) => p.category === category);
    return this.uniqueSorted((inCategory.length ? inCategory : this.known()).map((p) => p.group));
  });
  protected readonly suppliers = computed(() => this.uniqueSorted(this.known().map((p) => p.supplier)));

  ngOnInit(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    this.name.set(product.name);
    this.barcode.set(product.barcode);
    this.category.set(product.category);
    this.group.set(product.group);
    this.supplier.set(product.supplier);
    this.status.set(product.status);
    this.usage.set(product.usage);
    this.posStatus.set(product.posStatus);
    this.unit.set(product.unit);
    this.costPrice.set(product.costPrice);
    this.salePrice.set(product.salePrice);
    this.unitLocked.set(product.stocks.some((stock) => stock.quantity !== 0));
  }

  save(): void {
    const payload = {
      name: this.name().trim(),
      barcode: this.barcode().trim(),
      category: this.category().trim(),
      group: this.group().trim(),
      supplier: this.supplier().trim(),
      status: this.status(),
      usage: this.usage(),
      posStatus: this.posStatus(),
      unit: this.unit(),
      costPrice: Number(this.costPrice()) || 0,
      salePrice: Number(this.salePrice()) || 0,
    };
    if ([payload.name, payload.barcode, payload.category, payload.group, payload.supplier].some((v) => !v)) {
      this.formError.set('Product, barcode, category, group and supplier are required.');
      return;
    }
    if (payload.costPrice < 0 || payload.salePrice < 0) {
      this.formError.set('Prices cannot be negative.');
      return;
    }

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

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
}
