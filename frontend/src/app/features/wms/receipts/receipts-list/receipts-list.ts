import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CircleCheck, LucideAngularModule, Package, PenLine, Plus, Search, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { RECEIPT_STATUS_LABELS, Receipt, ReceiptStatus } from '../receipt.model';
import { ReceiptService } from '../receipt.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

@Component({
  selector: 'app-receipts-list',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, DatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, Pager],
  templateUrl: './receipts-list.html',
})
export class ReceiptsList implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly columnOrder = new ColumnOrder('wms-receipts', [
    { key: 'number', label: 'Number' },
    { key: 'date', label: 'Date' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'waybill', label: 'Waybill' },
    { key: 'lines', label: 'Lines' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
    { key: 'createdBy', label: 'Created by' },
  ]);
  private readonly receiptService = inject(ReceiptService);
  private readonly auth = inject(AuthService);

  protected readonly ViewIcon = Package;
  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PostIcon = CircleCheck;
  protected readonly busyId = signal<string | null>(null);
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly statusLabels = RECEIPT_STATUS_LABELS;

  protected readonly canWrite = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'module_admin' || role === 'manager';
  });

  protected readonly receipts = signal<Receipt[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | ReceiptStatus>('all');
  protected readonly warehouseFilter = signal('all');

  protected readonly warehousesInList = computed(() => {
    const byId = new Map(this.receipts().map((r) => [r.warehouse.id, r.warehouse]));
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  });

  protected readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.statusFilter() !== 'all' || this.warehouseFilter() !== 'all',
  );

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.receipts().filter(
      (r) =>
        (this.statusFilter() === 'all' || r.status === this.statusFilter()) &&
        (this.warehouseFilter() === 'all' || r.warehouseId === this.warehouseFilter()) &&
        (!query ||
          [r.code, r.supplier?.name ?? r.rsSellerName ?? '', r.waybillNumber ?? '', r.warehouse.code, r.warehouse.name].some((value) =>
            value.toLowerCase().includes(query),
          )),
    );
  });

  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.statusFilter(), this.warehouseFilter()],
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.receiptService.list().subscribe({
      next: (receipts) => {
        this.receipts.set(receipts);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load receipts. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  postDraft(receipt: Receipt): void {
    const question = receipt.rsWaybillId
      ? 'Post this receipt? The waybill is confirmed in RS (მიღებული), the goods go into the warehouse and the receipt is locked.'
      : 'Post this receipt? The goods go into the warehouse and the receipt is locked.';
    if (!this.i18n.confirm(this.i18n.t('{code}: {question}', { code: receipt.code, question: this.i18n.t(question) }))) {
      return;
    }
    this.busyId.set(receipt.id);
    this.errorMessage.set('');
    this.receiptService.post(receipt.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);
        const message = error.error?.message;
        this.errorMessage.set(
          `${receipt.code}: ${this.i18n.t(Array.isArray(message) ? message.join('. ') : (message ?? 'Could not post the receipt.'))}`,
        );
      },
    });
  }

  deleteDraft(receipt: Receipt): void {
    if (!this.i18n.confirm(this.i18n.t('Delete draft {code}?', { code: receipt.code }))) {
      return;
    }
    this.receiptService.remove(receipt.id).subscribe({
      next: () => this.load(),
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the receipt.'),
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
    this.warehouseFilter.set('all');
  }
}
