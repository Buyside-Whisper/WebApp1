import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { ProductUnit } from '../../products/product.model';
import { PickableProduct, ProductPicker } from '../../stock/product-picker/product-picker';
import { WarehouseStockRow } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { WarehouseOption } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { Transfer, TransferPayload } from '../transfer.model';
import { TransferService } from '../transfer.service';

interface EditableLine {
  productId: string;
  name: string;
  barcode: string;
  unit: ProductUnit;
  quantity: number;
}

const today = () => new Date().toLocaleDateString('sv-SE');

@Component({
  selector: 'app-transfer-editor',
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, ProductPicker],
  templateUrl: './transfer-editor.html',
})
export class TransferEditor implements OnInit {
  private readonly transferService = inject(TransferService);
  private readonly stockService = inject(StockService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly router = inject(Router);

  readonly id = input<string>();

  protected readonly DeleteIcon = Trash2;

  protected readonly warehouses = signal<WarehouseOption[]>([]);
  protected readonly sourceStock = signal<WarehouseStockRow[]>([]);
  protected readonly code = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly fromWarehouseId = signal('');
  protected readonly toWarehouseId = signal('');
  protected readonly date = signal(today());
  protected readonly note = signal('');
  protected readonly lines = signal<EditableLine[]>([]);

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
  protected readonly available = computed(
    () => new Map(this.sourceStock().map((row) => [row.productId, row.quantity])),
  );
  protected readonly takenIds = computed(() => this.lines().map((line) => line.productId));

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
    if (this.lines().length && !confirm('Changing the source warehouse removes the products added so far.')) {
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
      { productId: product.id, name: product.name, barcode: product.barcode, unit: product.unit, quantity: 1 },
    ]);
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
    if (andSend && !confirm('Send this transfer? The goods leave the source warehouse now.')) {
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
    for (const [i, line] of payload.lines.entries()) {
      const { name, unit } = this.lines()[i];
      const available = this.available().get(line.productId) ?? 0;
      if (line.quantity <= 0) {
        return `Enter a quantity for ${name}.`;
      }
      if (unit === 'pcs' && !Number.isInteger(line.quantity)) {
        return `${name} is counted in pcs, so its quantity must be whole.`;
      }
      if (andSend && line.quantity > available) {
        return `Only ${available} ${unit} of ${name} available.`;
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
    this.lines.set(
      (transfer.lines ?? []).map((line) => ({
        productId: line.productId,
        name: line.product.name,
        barcode: line.product.barcode,
        unit: line.product.unit,
        quantity: line.quantity,
      })),
    );
    this.loadSourceStock(transfer.fromWarehouseId);
  }
}
