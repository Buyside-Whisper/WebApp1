import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { WarehouseOption } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { TRANSFER_STATUS_LABELS, Transfer } from '../transfer.model';
import { TransferService } from '../transfer.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

@Component({
  selector: 'app-transfer-view',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './transfer-view.html',
})
export class TransferView implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly transferService = inject(TransferService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly statusLabels = TRANSFER_STATUS_LABELS;
  protected readonly transfer = signal<Transfer | null>(null);
  protected readonly warehouses = signal<WarehouseOption[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly isBusy = signal(false);

  protected readonly receiving = signal(false);
  protected readonly received = signal<Record<string, number>>({});

  protected readonly canWrite = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'module_admin' || role === 'manager';
  });
  protected readonly canOpenProducts = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });
  private readonly mine = computed(() => new Set(this.warehouses().filter((w) => w.mine).map((w) => w.id)));
  protected readonly columnOrder = new ColumnOrder(
    'wms-transfer-lines',
    [
      { key: 'product', label: 'Product' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'sent', label: 'Sent' },
      { key: 'received', label: 'Received' },
      { key: 'missing', label: 'Missing' },
      { key: 'unit', label: 'Unit' },
    ],
    (key) => (key !== 'received' && key !== 'missing') || this.receiving() || this.transfer()?.status === 'received',
  );
  protected readonly actsForSource = computed(
    () => this.canWrite() && this.mine().has(this.transfer()?.fromWarehouseId ?? ''),
  );
  protected readonly actsForDestination = computed(
    () => this.canWrite() && this.mine().has(this.transfer()?.toWarehouseId ?? ''),
  );
  protected readonly shortLines = computed(
    () => (this.transfer()?.lines ?? []).filter((l) => l.receivedQuantity !== null && l.receivedQuantity < l.quantity).length,
  );

  ngOnInit(): void {
    this.warehouseService.options().subscribe((warehouses) => this.warehouses.set(warehouses));
    this.transferService.get(this.id()).subscribe({
      next: (transfer) => this.transfer.set(transfer),
      error: () => this.errorMessage.set('Could not load the transfer.'),
    });
  }

  send(): void {
    if (this.i18n.confirm('Send this transfer? The goods leave the source warehouse now.')) {
      this.run(this.transferService.send(this.id()));
    }
  }

  cancel(): void {
    const question = this.transfer()?.rsWaybillId
      ? 'Cancel this transfer? This works only after the waybill was cancelled in RS. The goods go back into the source warehouse.'
      : 'Cancel this transfer? The goods go back into the source warehouse.';
    if (this.i18n.confirm(question)) {
      this.run(this.transferService.cancel(this.id()));
    }
  }

  remove(): void {
    if (!this.i18n.confirm('Delete this draft?')) {
      return;
    }
    this.transferService.remove(this.id()).subscribe({
      next: () => void this.router.navigate(['/wms/transfers']),
      error: (error: HttpErrorResponse) => this.errorMessage.set(error.error?.message ?? 'Could not delete it.'),
    });
  }

  startReceiving(): void {
    const transfer = this.transfer();
    if (transfer?.rsWaybillId) {
      if (
        this.i18n.confirm(
          this.i18n.t('Receive everything on waybill {waybillNumber}? The waybill is closed in RS (დასრულებული) and the goods go into {code}.', { waybillNumber: transfer.waybillNumber, code: transfer.toWarehouse.code }),
        )
      ) {
        this.run(
          this.transferService.receive(
            this.id(),
            (transfer.lines ?? []).map((line) => ({ lineId: line.id, receivedQuantity: line.quantity })),
          ),
        );
      }
      return;
    }
    const lines = this.transfer()?.lines ?? [];
    this.received.set(Object.fromEntries(lines.map((line) => [line.id, line.quantity])));
    this.receiving.set(true);
  }

  setReceived(lineId: string, value: number): void {
    this.received.update((received) => ({ ...received, [lineId]: value }));
  }

  confirmReceipt(): void {
    const lines = this.transfer()?.lines ?? [];
    const entries = lines.map((line) => ({ line, value: Number(this.received()[line.id]) }));
    const bad = entries.find(({ line, value }) => !(value >= 0) || value > line.quantity);
    if (bad) {
      this.errorMessage.set(this.i18n.t('{value}: enter between 0 and {quantity}.', { value: bad.line.product?.name ?? bad.line.rsName, quantity: bad.line.quantity }));
      return;
    }
    const short = entries.filter(({ line, value }) => value < line.quantity).length;
    const question = short
      ? this.i18n.t('{short} product(s) arrived short. Confirm? The difference is recorded as missing.', { short })
      : 'Confirm that everything arrived?';
    if (this.i18n.confirm(question)) {
      this.run(
        this.transferService.receive(
          this.id(),
          entries.map(({ line, value }) => ({ lineId: line.id, receivedQuantity: value })),
        ),
      );
    }
  }

  private run(request: Observable<Transfer>): void {
    this.isBusy.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (transfer) => {
        this.transfer.set(transfer);
        this.isBusy.set(false);
        this.receiving.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isBusy.set(false);
        const message = error.error?.message;
        this.errorMessage.set(Array.isArray(message) ? message.join('. ') : (message ?? 'Something went wrong.'));
      },
    });
  }
}
