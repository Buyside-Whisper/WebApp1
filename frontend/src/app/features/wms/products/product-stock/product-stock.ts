import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StockMovement } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { Product } from '../product.model';

// Goods that left a warehouse on a transfer and haven't been received yet.
interface InTransit {
  documentId: string;
  code: string;
  from: { code: string; name: string };
  quantity: number;
  sentAt: string;
}

// Where one product is: quantity per warehouse, its share and value, when each last changed, and
// what is on the way. Shown in a pop-up from the Products table (put it inside an @if).
@Component({
  selector: 'app-product-stock',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './product-stock.html',
})
export class ProductStock implements OnInit {
  private readonly stockService = inject(StockService);

  readonly product = input.required<Product>();

  protected readonly movements = signal<StockMovement[] | null>(null);

  protected readonly rows = computed(() => {
    const product = this.product();
    const total = product.quantity;
    const lastChange = new Map<string, string>();
    for (const movement of this.movements() ?? []) {
      // Newest first, so the first one seen per warehouse is the latest.
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

  // A transfer is in transit while it has a "sent" movement but no "received" / "cancelled" one.
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
