import { Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { STOCK_MOVEMENT_LABELS, StockMovement, movementDocumentLink } from '../stock.model';

// The stock history table, newest first, on the product and warehouse View pages. The page it's on
// already says which product / warehouse it is, so that column can be hidden.
@Component({
  selector: 'app-movement-history',
  imports: [DatePipe, DecimalPipe, RouterLink, Pager],
  templateUrl: './movement-history.html',
})
export class MovementHistory {
  readonly movements = input.required<StockMovement[]>();
  readonly showProduct = input(false);
  readonly showWarehouse = input(false);
  // Link product names to their View page (only admins can open it).
  readonly linkProducts = input(false);

  protected readonly labels = STOCK_MOVEMENT_LABELS;
  protected readonly documentLink = movementDocumentLink;
  protected readonly pages = new Pagination(() => this.movements());
}
