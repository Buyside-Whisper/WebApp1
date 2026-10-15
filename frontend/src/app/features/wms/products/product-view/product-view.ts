import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MovementHistory } from '../../stock/movement-history/movement-history';
import { StockMovement } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { PRODUCT_POS_STATUS_LABELS, PRODUCT_USAGE_LABELS, Product } from '../product.model';
import { ProductService } from '../product.service';

// One product: its catalogue details, where it is (stock by warehouse) and its stock history.
@Component({
  selector: 'app-product-view',
  imports: [DecimalPipe, RouterLink, MovementHistory],
  templateUrl: './product-view.html',
})
export class ProductView implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly stockService = inject(StockService);

  // Route param, bound by withComponentInputBinding().
  readonly id = input.required<string>();

  protected readonly usageLabels = PRODUCT_USAGE_LABELS;
  protected readonly posStatusLabels = PRODUCT_POS_STATUS_LABELS;

  protected readonly product = signal<Product | null>(null);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly errorMessage = signal('');

  // Total value of the stock at cost price.
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
