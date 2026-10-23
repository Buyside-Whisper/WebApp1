import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Search } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { MovementHistory } from '../../stock/movement-history/movement-history';
import { StockMovement, WarehouseStockRow } from '../../stock/stock.model';
import { StockService } from '../../stock/stock.service';
import { Warehouse } from '../warehouse.model';
import { WarehouseService } from '../warehouse.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

@Component({
  selector: 'app-warehouse-view',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, Pager, MovementHistory],
  templateUrl: './warehouse-view.html',
})
export class WarehouseView implements OnInit {
  protected readonly columnOrder = new ColumnOrder('wms-warehouse-stock', [
    { key: 'product', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'category', label: 'Category' },
    { key: 'group', label: 'Group' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'unit', label: 'Unit' },
    { key: 'costPrice', label: 'Cost price' },
    { key: 'value', label: 'Value' },
  ]);
  private readonly warehouseService = inject(WarehouseService);
  private readonly stockService = inject(StockService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly SearchIcon = Search;
  protected readonly canOpenProducts = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });

  protected readonly warehouse = signal<Warehouse | null>(null);
  protected readonly stock = signal<WarehouseStockRow[]>([]);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly filteredStock = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.stock();
    }
    return this.stock().filter(({ product }) =>
      [product.name, product.barcode, product.category.name, product.group].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  });
  protected readonly pages = new Pagination(
    () => this.filteredStock(),
    () => this.search(),
  );

  ngOnInit(): void {
    this.warehouseService.get(this.id()).subscribe({
      next: (warehouse) => this.warehouse.set(warehouse),
      error: () => this.errorMessage.set('Could not load the warehouse.'),
    });
    this.stockService.warehouseStock(this.id()).subscribe({
      next: (stock) => this.stock.set(stock),
      error: () => this.errorMessage.set('Could not load the products in this warehouse.'),
    });
    this.stockService.warehouseMovements(this.id()).subscribe({
      next: (movements) => this.movements.set(movements),
      error: () => this.errorMessage.set('Could not load the stock history.'),
    });
  }
}
