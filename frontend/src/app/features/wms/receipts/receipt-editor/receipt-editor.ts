import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { ProductForm } from '../../products/product-form/product-form';
import { Product, ProductOption, ProductUnit } from '../../products/product.model';
import { ProductService } from '../../products/product.service';
import { PickableProduct, ProductPicker } from '../../stock/product-picker/product-picker';
import { WarehouseOption } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { Receipt, ReceiptPayload } from '../receipt.model';
import { ReceiptService } from '../receipt.service';

interface EditableLine {
  productId: string;
  name: string;
  barcode: string;
  unit: ProductUnit;
  quantity: number;
  unitCost: number;
}

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time

// New receipt (/wms/receipts/new) or editing a draft (/wms/receipts/:id/edit).
@Component({
  selector: 'app-receipt-editor',
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, ProductPicker, Modal, ProductForm],
  templateUrl: './receipt-editor.html',
})
export class ReceiptEditor implements OnInit {
  private readonly receiptService = inject(ReceiptService);
  private readonly productService = inject(ProductService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  // Route param; missing for a new receipt.
  readonly id = input<string>();

  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;

  // "New product" without leaving the receipt: only the WMS admin manages the catalogue.
  protected readonly canCreateProducts = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly isProductFormOpen = signal(false);
  protected readonly productNotice = signal('');

  protected readonly warehouses = signal<WarehouseOption[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly code = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly warehouseId = signal('');
  protected readonly supplier = signal('');
  protected readonly waybillNumber = signal('');
  protected readonly date = signal(today());
  protected readonly note = signal('');
  protected readonly lines = signal<EditableLine[]>([]);

  // Only active warehouses the user works with.
  protected readonly myWarehouses = computed(() =>
    this.warehouses().filter((w) => w.mine && w.status === 'active'),
  );
  protected readonly takenIds = computed(() => this.lines().map((line) => line.productId));
  protected readonly total = computed(() =>
    this.lines().reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0),
  );

  ngOnInit(): void {
    this.warehouseService.options().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        if (!this.id() && this.myWarehouses().length === 1) {
          this.warehouseId.set(this.myWarehouses()[0].id);
        }
      },
      error: () => this.errorMessage.set('Could not load warehouses.'),
    });
    this.productService.options().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.errorMessage.set('Could not load products.'),
    });
    // Set when a new receipt was saved but could not be posted (see post()).
    const carried = (history.state as { error?: string } | null)?.error;
    if (carried) {
      this.errorMessage.set(carried);
    }
    const id = this.id();
    if (id) {
      this.receiptService.get(id).subscribe({
        next: (receipt) => this.fill(receipt),
        error: () => this.errorMessage.set('Could not load the receipt.'),
      });
    }
  }

  addProduct(picked: PickableProduct): void {
    const product = this.products().find((p) => p.id === picked.id)!;
    this.lines.update((lines) => [
      ...lines,
      {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        quantity: 1,
        unitCost: product.costPrice, // the current cost as a starting point
      },
    ]);
  }

  // A product created from the receipt goes straight onto it (if it is active, so it can be received).
  onProductCreated(product: Product): void {
    this.isProductFormOpen.set(false);
    if (product.status !== 'active') {
      this.productNotice.set(`${product.name} was added to Products, but it is Not active, so it can't be received.`);
      return;
    }
    this.products.update((products) => [...products, product]);
    this.addProduct(product);
    this.productNotice.set(`${product.name} was added to Products and to this receipt.`);
  }

  updateLine(index: number, field: 'quantity' | 'unitCost', value: number): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  save(andPost: boolean): void {
    const payload = this.payload();
    const problem = this.validate(payload, andPost);
    if (problem) {
      this.errorMessage.set(problem);
      return;
    }
    if (andPost && !confirm('Post this receipt? The goods go into the warehouse and the receipt is locked.')) {
      return;
    }

    const id = this.id();
    const request = id ? this.receiptService.update(id, payload) : this.receiptService.create(payload);
    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (saved) => (andPost ? this.post(saved) : void this.router.navigate(['/wms/receipts', saved.id])),
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not save the receipt.'),
    });
  }

  // The draft is saved by now. If posting fails (e.g. a warehouse just became inactive), keep
  // editing that draft instead of creating another one.
  private post(saved: Receipt): void {
    this.receiptService.post(saved.id).subscribe({
      next: () => void this.router.navigate(['/wms/receipts', saved.id]),
      error: (error: HttpErrorResponse) => {
        if (this.id()) {
          this.fail(error, 'Could not post the receipt.');
        } else {
          void this.router.navigate(['/wms/receipts', saved.id, 'edit'], {
            state: { error: this.message(error, 'Could not post the receipt.') },
          });
        }
      },
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.isSaving.set(false);
    this.errorMessage.set(this.message(error, fallback));
  }

  private message(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join('. ') : (message ?? fallback);
  }

  private payload(): ReceiptPayload {
    return {
      warehouseId: this.warehouseId(),
      supplier: this.supplier().trim(),
      waybillNumber: this.waybillNumber().trim() || null,
      date: this.date(),
      note: this.note().trim() || null,
      lines: this.lines().map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity) || 0,
        unitCost: Number(line.unitCost) || 0,
      })),
    };
  }

  private validate(payload: ReceiptPayload, andPost: boolean): string {
    if (!payload.warehouseId || !payload.supplier || !payload.date) {
      return 'Warehouse, supplier and date are required.';
    }
    if (andPost && payload.lines.length === 0) {
      return 'Add at least one product before posting.';
    }
    for (const [i, line] of payload.lines.entries()) {
      const { name, unit } = this.lines()[i];
      if (line.quantity <= 0) {
        return `Enter a quantity for ${name}.`;
      }
      if (unit === 'pcs' && !Number.isInteger(line.quantity)) {
        return `${name} is counted in pcs, so its quantity must be whole.`;
      }
      if (line.unitCost < 0) {
        return `The price of ${name} can't be negative.`;
      }
    }
    return '';
  }

  private fill(receipt: Receipt): void {
    if (receipt.status !== 'draft') {
      void this.router.navigate(['/wms/receipts', receipt.id]); // only drafts are editable
      return;
    }
    this.code.set(receipt.code);
    this.warehouseId.set(receipt.warehouseId);
    this.supplier.set(receipt.supplier);
    this.waybillNumber.set(receipt.waybillNumber ?? '');
    this.date.set(receipt.date);
    this.note.set(receipt.note ?? '');
    this.lines.set(
      (receipt.lines ?? []).map((line) => ({
        productId: line.productId,
        name: line.product.name,
        barcode: line.product.barcode,
        unit: line.product.unit,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    );
  }
}
