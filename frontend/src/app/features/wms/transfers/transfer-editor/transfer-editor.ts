import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { ProductForm } from '../../products/product-form/product-form';
import { Product, ProductOption, ProductUnit } from '../../products/product.model';
import { ProductService } from '../../products/product.service';
import { PickableProduct, ProductPicker } from '../../stock/product-picker/product-picker';
import { WarehouseStockRow } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { WarehouseOption } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { rsProductUnit } from '../../receipts/receipt.model';
import { Transfer, TransferPayload } from '../transfer.model';
import { TransferService } from '../transfer.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

interface EditableLine {
  productId: string | null;
  name: string | null;
  barcode: string | null;
  unit: ProductUnit | null;
  quantity: number;
  rs: { name: string; barcode: string | null; unitId: number | null; unit: string | null } | null;
}

const today = () => new Date().toLocaleDateString('sv-SE');

@Component({
  selector: 'app-transfer-editor',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, ProductPicker, Modal, ProductForm],
  templateUrl: './transfer-editor.html',
  styleUrl: './transfer-editor.css',
})
export class TransferEditor implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly lineColumns = new ColumnOrder('wms-transfer-lines-edit', [
    { key: 'product', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'available', label: 'Available' },
    { key: 'quantityToSend', label: 'Quantity to send' },
    { key: 'unit', label: 'Unit' },
  ]);
  protected readonly rsColumns = new ColumnOrder('wms-transfer-rs-lines', [
    { key: 'onTheWaybill', label: 'On the waybill' },
    { key: 'yourProduct', label: 'Your product' },
    { key: 'availableInSource', label: 'Available in source' },
    { key: 'quantity', label: 'Quantity' },
  ]);
  private readonly transferService = inject(TransferService);
  private readonly stockService = inject(StockService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly id = input<string>();

  protected readonly DeleteIcon = Trash2;

  protected readonly warehouses = signal<WarehouseOption[]>([]);
  protected readonly sourceStock = signal<WarehouseStockRow[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly canCreateProducts = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly isProductFormOpen = signal(false);
  protected readonly linkingIndex = signal<number | null>(null);
  protected readonly productNotice = signal('');
  protected readonly code = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly fromWarehouseId = signal('');
  protected readonly toWarehouseId = signal('');
  protected readonly date = signal(today());
  protected readonly note = signal('');
  protected readonly lines = signal<EditableLine[]>([]);
  protected readonly rsWaybillId = signal<string | null>(null);
  protected readonly waybillNumber = signal('');
  protected readonly unlinkedCount = computed(() => this.lines().filter((line) => !line.productId).length);

  protected readonly sources = computed(() => this.warehouses().filter((w) => w.mine && w.status === 'active'));
  protected readonly destinations = computed(() =>
    this.warehouses().filter((w) => w.status === 'active' && w.id !== this.fromWarehouseId()),
  );

  protected readonly pickable = computed<PickableProduct[]>(() =>
    this.sourceStock()
      .filter((row) => row.quantity > 0)
      .map((row) => ({
        id: row.productId,
        name: row.product.name,
        barcode: row.product.barcode,
        unit: row.product.unit,
        available: row.quantity,
      })),
  );
  protected readonly linkable = computed<PickableProduct[]>(() =>
    this.products()
      .map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        available: this.available().get(product.id) ?? 0,
      }))
      .sort((a, b) => Number(b.available > 0) - Number(a.available > 0)),
  );
  protected readonly newProductDraft = computed(() => {
    const line = this.linkingIndex() === null ? undefined : this.lines()[this.linkingIndex()!];
    return line?.rs
      ? { name: line.rs.name, barcode: line.rs.barcode ?? '', unit: rsProductUnit(line.rs) ?? 'pcs' }
      : null;
  });
  protected readonly available = computed(
    () => new Map(this.sourceStock().map((row) => [row.productId, row.quantity])),
  );
  protected readonly takenIds = computed(() => this.lines().flatMap((line) => (line.productId ? [line.productId] : [])));

  ngOnInit(): void {
    this.warehouseService.options().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        if (!this.id() && this.sources().length === 1) {
          this.changeSource(this.sources()[0].id);
        }
      },
      error: () => this.errorMessage.set('Could not load warehouses.'),
    });
    this.productService.options().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.errorMessage.set('Could not load products.'),
    });
    const carried = (history.state as { error?: string } | null)?.error;
    if (carried) {
      this.errorMessage.set(carried);
    }
    const id = this.id();
    if (id) {
      this.transferService.get(id).subscribe({
        next: (transfer) => this.fill(transfer),
        error: () => this.errorMessage.set('Could not load the transfer.'),
      });
    }
  }

  changeSource(warehouseId: string): void {
    if (this.rsWaybillId()) {
      this.fromWarehouseId.set(warehouseId);
      if (this.toWarehouseId() === warehouseId) {
        this.toWarehouseId.set('');
      }
      this.loadSourceStock(warehouseId);
      return;
    }
    if (this.lines().length && !this.i18n.confirm('Changing the source warehouse removes the products added so far.')) {
      return;
    }
    this.fromWarehouseId.set(warehouseId);
    this.lines.set([]);
    if (this.toWarehouseId() === warehouseId) {
      this.toWarehouseId.set('');
    }
    this.loadSourceStock(warehouseId);
  }

  addProduct(product: PickableProduct): void {
    this.lines.update((lines) => [
      ...lines,
      { productId: product.id, name: product.name, barcode: product.barcode, unit: product.unit, quantity: 1, rs: null },
    ]);
  }

  linkProduct(index: number, picked: PickableProduct): void {
    this.lines.update((lines) =>
      lines.map((line, i) =>
        i === index ? { ...line, productId: picked.id, name: picked.name, barcode: picked.barcode, unit: picked.unit } : line,
      ),
    );
  }

  openProductForm(index: number): void {
    this.productNotice.set('');
    this.linkingIndex.set(index);
    this.isProductFormOpen.set(true);
  }

  onProductCreated(product: Product): void {
    this.isProductFormOpen.set(false);
    const index = this.linkingIndex();
    if (product.status !== 'active' || index === null) {
      this.productNotice.set(this.i18n.t('{name} was added to Products, but it is Not active, so it can\'t be moved.', { name: product.name }));
      return;
    }
    this.products.update((products) => [...products, product]);
    this.linkProduct(index, product);
    this.productNotice.set(this.i18n.t('{name} was added to Products and linked to the waybill line.', { name: product.name }));
  }

  unlinkProduct(index: number): void {
    this.lines.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, productId: null, name: null, barcode: null, unit: null } : line)),
    );
  }

  protected unitProblem(line: EditableLine): string {
    if (!line.rs || !line.unit) {
      return '';
    }
    const expected = rsProductUnit(line.rs);
    if (!expected) {
      return this.i18n.t('The waybill counts it in {value}; products are only pcs or kg.', { value: line.rs.unit ?? 'an unknown unit' });
    }
    return expected === line.unit ? '' : this.i18n.t('The waybill says {unit}, but this product is counted in {unit2}.', { unit: line.rs.unit, unit2: line.unit });
  }

  updateQuantity(index: number, value: number): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, quantity: value } : line)));
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  save(andSend: boolean): void {
    const payload = this.payload();
    const problem = this.validate(payload, andSend);
    if (problem) {
      this.errorMessage.set(problem);
      return;
    }
    if (
      andSend &&
      !this.i18n.confirm(
        this.rsWaybillId()
          ? 'Send this transfer? The goods leave the source warehouse now. The RS waybill is already active, so nothing changes in RS.'
          : 'Send this transfer? The goods leave the source warehouse now.',
      )
    ) {
      return;
    }
    const id = this.id();
    const request = id ? this.transferService.update(id, payload) : this.transferService.create(payload);
    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (saved) => (andSend ? this.send(saved) : void this.router.navigate(['/wms/transfers', saved.id])),
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not save the transfer.'),
    });
  }

  private send(saved: Transfer): void {
    this.transferService.send(saved.id).subscribe({
      next: () => void this.router.navigate(['/wms/transfers', saved.id]),
      error: (error: HttpErrorResponse) => {
        if (this.id()) {
          this.fail(error, 'Could not send the transfer.');
        } else {
          void this.router.navigate(['/wms/transfers', saved.id, 'edit'], {
            state: { error: this.message(error, 'Could not send the transfer.') },
          });
        }
      },
    });
  }

  private loadSourceStock(warehouseId: string): void {
    this.sourceStock.set([]);
    this.stockService.warehouseStock(warehouseId).subscribe({
      next: (rows) => this.sourceStock.set(rows),
      error: () => this.errorMessage.set('Could not load what that warehouse has.'),
    });
  }

  private payload(): TransferPayload {
    return {
      fromWarehouseId: this.fromWarehouseId(),
      toWarehouseId: this.toWarehouseId(),
      date: this.date(),
      note: this.note().trim() || null,
      lines: this.lines().map((line) => ({ productId: line.productId, quantity: Number(line.quantity) || 0 })),
    };
  }

  private validate(payload: TransferPayload, andSend: boolean): string {
    if (!payload.fromWarehouseId || !payload.toWarehouseId || !payload.date) {
      return 'Choose both warehouses and a date.';
    }
    if (andSend && payload.lines.length === 0) {
      return 'Add at least one product before sending.';
    }
    if (this.rsWaybillId()) {
      if (!andSend) {
        return '';
      }
      if (this.unlinkedCount()) {
        return this.i18n.t('Link every waybill line to one of your products first ({unlinkedCount} left).', { unlinkedCount: this.unlinkedCount() });
      }
      const problem = this.lines().find((line) => this.unitProblem(line));
      if (problem) {
        return `${problem.rs?.name}: ${this.unitProblem(problem)}`;
      }
    }
    for (const [i, line] of payload.lines.entries()) {
      const { name, unit } = this.lines()[i];
      if (!line.productId) {
        continue;
      }
      const available = this.available().get(line.productId) ?? 0;
      if (line.quantity <= 0) {
        return this.i18n.t('Enter a quantity for {name}.', { name });
      }
      if (unit === 'pcs' && !Number.isInteger(line.quantity)) {
        return this.i18n.t('{name} is counted in pcs, so its quantity must be whole.', { name });
      }
      if (andSend && line.quantity > available) {
        return this.i18n.t('Only {available} {unit} of {name} available.', { available, unit, name });
      }
    }
    return '';
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.isSaving.set(false);
    this.errorMessage.set(this.message(error, fallback));
  }

  private message(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join('. ') : (message ?? fallback);
  }

  private fill(transfer: Transfer): void {
    if (transfer.status !== 'draft') {
      void this.router.navigate(['/wms/transfers', transfer.id]);
      return;
    }
    this.code.set(transfer.code);
    this.fromWarehouseId.set(transfer.fromWarehouseId);
    this.toWarehouseId.set(transfer.toWarehouseId);
    this.date.set(transfer.date);
    this.note.set(transfer.note ?? '');
    this.rsWaybillId.set(transfer.rsWaybillId);
    this.waybillNumber.set(transfer.waybillNumber ?? '');
    this.lines.set(
      (transfer.lines ?? []).map((line) => ({
        productId: line.productId,
        name: line.product?.name ?? null,
        barcode: line.product?.barcode ?? null,
        unit: line.product?.unit ?? null,
        quantity: line.quantity,
        rs: line.rsName ? { name: line.rsName, barcode: line.rsBarcode, unitId: line.rsUnitId, unit: line.rsUnit } : null,
      })),
    );
    this.loadSourceStock(transfer.fromWarehouseId);
  }
}
