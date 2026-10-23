import { Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { STOCK_MOVEMENT_LABELS, StockMovement, movementDocumentLink } from '../stock.model';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-movement-history',
  imports: [TranslatePipe, DatePipe, DecimalPipe, RouterLink, Pager],
  templateUrl: './movement-history.html',
})
export class MovementHistory {
  readonly movements = input.required<StockMovement[]>();
  readonly showProduct = input(false);
  readonly showWarehouse = input(false);
  readonly linkProducts = input(false);

  protected readonly labels = STOCK_MOVEMENT_LABELS;
  protected readonly documentLink = movementDocumentLink;
  protected readonly pages = new Pagination(() => this.movements());
}
