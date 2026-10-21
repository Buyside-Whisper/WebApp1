import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Download,
  LucideAngularModule,
  Package,
  PenLine,
  Search,
  Plus,
  Trash2,
  Upload,
} from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { ColumnOrder } from '../../../../shared/column-order/column-order';
import { Modal } from '../../../../shared/modal/modal';
import { ProductForm } from '../product-form/product-form';
import { ProductStock } from '../product-stock/product-stock';
import { ProductTabs } from '../product-tabs/product-tabs';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { XlsxImport } from '../../../../shared/xlsx-import/xlsx-import';
import { PreviewColumn, saveFile, today } from '../../../../shared/xlsx-import/xlsx-import.model';
import { Warehouse } from '../../warehouses/warehouse.model';
import {
  PRODUCT_POS_STATUS_LABELS,
  PRODUCT_USAGE_LABELS,
  Product,
  ProductPosStatus,
  ProductPreviewRow,
  ProductStatus,
  ProductUnit,
  ProductUsage,
} from '../product.model';
import { ProductService } from '../product.service';

@Component({
  selector: 'app-products-list',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    Modal,
    Pager,
    ProductForm,
    ProductStock,
    ProductTabs,
    XlsxImport,
  ],
  templateUrl: './products-list.html',
})
export class ProductsList implements OnInit {
  protected readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);

  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly usageLabels = PRODUCT_USAGE_LABELS;
  protected readonly posStatusLabels = PRODUCT_POS_STATUS_LABELS;

  protected readonly ViewIcon = Package;
  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly ImportIcon = Upload;
  protected readonly ExportIcon = Download;

  protected readonly columnOrder = new ColumnOrder('wms-products', [
    { key: 'name', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'category', label: 'Category' },
    { key: 'group', label: 'Group' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'status', label: 'Production status' },
    { key: 'usage', label: 'Use' },
    { key: 'posStatus', label: 'POS status' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'unit', label: 'Unit' },
    { key: 'costPrice', label: 'Cost price' },
    { key: 'salePrice', label: 'Sale price' },
    { key: 'warehouses', label: 'Warehouses' },
  ]);

  protected readonly products = signal<Product[]>([]);

  protected readonly search = signal('');
  protected readonly categoryFilter = signal('all');
  protected readonly groupFilter = signal('all');
  protected readonly supplierFilter = signal('all');
  protected readonly warehouseFilter = signal('all');
  protected readonly usageFilter = signal<'all' | ProductUsage>('all');
  protected readonly posStatusFilter = signal<'all' | ProductPosStatus>('all');
  protected readonly statusFilter = signal<'all' | ProductStatus>('all');
  protected readonly unitFilter = signal<'all' | ProductUnit>('all');
  protected readonly stockFilter = signal<'all' | 'in' | 'out'>('all');

  protected readonly filterGroups = computed(() => {
    const category = this.categoryFilter();
    return this.uniqueSorted(
      this.products()
        .filter((p) => category === 'all' || p.categoryId === category)
        .map((p) => p.group),
    );
  });

  protected readonly warehousesInList = computed(() => {
    const byId = new Map<string, Warehouse>();
    for (const product of this.products()) {
      for (const stock of product.stocks) {
        byId.set(stock.warehouseId, stock.warehouse);
      }
    }
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  });

  private readonly filterValues = computed(() => [
    this.categoryFilter(),
    this.groupFilter(),
    this.supplierFilter(),
    this.warehouseFilter(),
    this.usageFilter(),
    this.posStatusFilter(),
    this.statusFilter(),
    this.unitFilter(),
    this.stockFilter(),
  ]);

  protected readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.filterValues().some((value) => value !== 'all'),
  );

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const warehouse = this.warehouseFilter();
    const stock = this.stockFilter();
    const matches = (filter: string, value: string) => filter === 'all' || filter === value;
    return this.products().filter(
      (p) =>
        matches(this.categoryFilter(), p.categoryId) &&
        matches(this.groupFilter(), p.group) &&
        matches(this.supplierFilter(), p.supplierId) &&
        matches(this.usageFilter(), p.usage) &&
        matches(this.posStatusFilter(), p.posStatus) &&
        matches(this.statusFilter(), p.status) &&
        matches(this.unitFilter(), p.unit) &&
        (warehouse === 'all' ||
          (warehouse === 'none'
            ? p.stocks.length === 0
            : p.stocks.some((s) => s.warehouseId === warehouse))) &&
        (stock === 'all' || (stock === 'in') === p.quantity > 0) &&
        (!query ||
          [p.name, p.barcode, p.category.name, p.group, p.supplier.name].some((value) =>
            value.toLowerCase().includes(query),
          )),
    );
  });

  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.filterValues()],
  );

  setCategoryFilter(category: string): void {
    this.categoryFilter.set(category);
    this.groupFilter.set('all');
  }

  clearFilters(): void {
    this.search.set('');
    for (const filter of [
      this.categoryFilter,
      this.groupFilter,
      this.supplierFilter,
      this.warehouseFilter,
      this.usageFilter,
      this.posStatusFilter,
      this.statusFilter,
      this.unitFilter,
      this.stockFilter,
    ]) {
      filter.set('all');
    }
  }
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly isFormOpen = signal(false);
  protected readonly isImportOpen = signal(false);
  protected readonly isExporting = signal(false);

  protected readonly importColumns: PreviewColumn<ProductPreviewRow>[] = [
    { label: 'Product', value: (row) => row.name, strong: true },
    { label: 'Barcode', value: (row) => row.barcode },
    { label: 'Category', value: (row) => `${row.category} / ${row.group}` },
    { label: 'Supplier', value: (row) => row.supplier },
    { label: 'Unit', value: (row) => row.unit },
    { label: 'Use', value: (row) => PRODUCT_USAGE_LABELS[row.usage] },
    { label: 'POS', value: (row) => PRODUCT_POS_STATUS_LABELS[row.posStatus] },
    { label: 'Status', value: (row) => (row.status === 'active' ? 'Active' : 'Not active') },
    { label: 'Cost', value: (row) => `₾${row.costPrice.toFixed(2)}`, figure: true },
    { label: 'Sale', value: (row) => `₾${row.salePrice.toFixed(2)}`, figure: true },
  ];

  protected readonly categories = computed(() => this.uniqueById(this.products().map((p) => p.category)));
  protected readonly suppliers = computed(() => this.uniqueById(this.products().map((p) => p.supplier)));

  protected readonly stockOf = signal<Product | null>(null);

  protected readonly editing = signal<Product | null>(null);

  ngOnInit(): void {
    this.loadProducts();
  }

  exportProducts(): void {
    this.isExporting.set(true);
    this.productService.export().subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        saveFile(blob, `products-${today()}.xlsx`);
      },
      error: () => {
        this.isExporting.set(false);
        this.errorMessage.set('Could not export the products. Is the backend running?');
      },
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

  editProduct(product: Product): void {
    this.editing.set(product);
    this.isFormOpen.set(true);
  }

  openAddForm(): void {
    this.editing.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
  }

  onSaved(): void {
    this.closeForm();
    this.loadProducts();
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete ${product.name} (${product.barcode})?`)) {
      return;
    }

    this.productService.remove(product.id).subscribe({
      next: () => {
        this.loadProducts();
      },
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the product.'),
    });
  }

  private uniqueById<T extends { id: string; name: string }>(items: T[]): T[] {
    return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
}
