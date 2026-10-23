import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StockMovement } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { Product } from '../product.model';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

interface InTransit {
  documentId: string;
  code: string;
  from: { code: string; name: string };
  quantity: number;
  sentAt: string;
}

@Component({
  selector: 'app-product-stock',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './product-stock.html',
})
export class ProductStock implements OnInit {
  protected readonly columnOrder = new ColumnOrder('wms-product-stock', [
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'type', label: 'Type' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'share', label: 'Share' },
    { key: 'value', label: 'Value' },
    { key: 'lastChange', label: 'Last change' },
  ]);
  private readonly stockService = inject(StockService);

  readonly product = input.required<Product>();

  protected readonly movements = signal<StockMovement[] | null>(null);

  protected readonly rows = computed(() => {
    const product = this.product();
    const total = product.quantity;
    const lastChange = new Map<string, string>();
    for (const movement of this.movements() ?? []) {
      if (!lastChange.has(movement.warehouse.id)) {
        lastChange.set(movement.warehouse.id, movement.createdAt);
      }
    }
    return [...product.stocks]
      .sort((a, b) => b.quantity - a.quantity)
      .map((stock) => ({
        ...stock,
        share: total > 0 ? stock.quantity / total : 0,
        value: stock.quantity * product.costPrice,
        lastChange: lastChange.get(stock.warehouseId) ?? null,
      }));
  });

  protected readonly totalValue = computed(() => this.product().quantity * this.product().costPrice);

  protected readonly inTransit = computed<InTransit[]>(() => {
    const movements = this.movements() ?? [];
    const finished = new Set(
      movements
        .filter((m) => m.kind === 'transfer_in' || m.kind === 'transfer_cancel')
        .map((m) => m.documentId),
    );
    return movements
      .filter((m) => m.kind === 'transfer_out' && m.documentId && !finished.has(m.documentId))
      .map((m) => ({
        documentId: m.documentId!,
        code: m.note ?? '',
        from: { code: m.warehouse.code, name: m.warehouse.name },
        quantity: -m.quantity,
        sentAt: m.createdAt,
      }));
  });

  ngOnInit(): void {
    this.stockService.productMovements(this.product().id).subscribe({
      next: (movements) => this.movements.set(movements),
      error: () => this.movements.set([]),
    });
  }
}
