import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MovementHistory } from '../../stock/movement-history/movement-history';
import { StockMovement } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { PRODUCT_POS_STATUS_LABELS, PRODUCT_USAGE_LABELS, Product } from '../product.model';
import { ProductService } from '../product.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

@Component({
  selector: 'app-product-view',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DecimalPipe, RouterLink, MovementHistory],
  templateUrl: './product-view.html',
})
export class ProductView implements OnInit {
  protected readonly columnOrder = new ColumnOrder('wms-product-warehouses', [
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'code', label: 'Code' },
    { key: 'type', label: 'Type' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'valueAtCost', label: 'Value (at cost)' },
  ]);
  private readonly productService = inject(ProductService);
  private readonly stockService = inject(StockService);

  readonly id = input.required<string>();

  protected readonly usageLabels = PRODUCT_USAGE_LABELS;
  protected readonly posStatusLabels = PRODUCT_POS_STATUS_LABELS;

  protected readonly product = signal<Product | null>(null);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly errorMessage = signal('');

  protected readonly stockValue = computed(() => {
    const product = this.product();
    return product ? product.quantity * product.costPrice : 0;
  });

  ngOnInit(): void {
    this.productService.get(this.id()).subscribe({
      next: (product) => this.product.set(product),
      error: () => this.errorMessage.set('Could not load the product.'),
    });
    this.stockService.productMovements(this.id()).subscribe({
      next: (movements) => this.movements.set(movements),
      error: () => this.errorMessage.set('Could not load the stock history.'),
    });
  }
}
