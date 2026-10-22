import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Package, PenLine, Plus, Search, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { RECEIPT_STATUS_LABELS, Receipt, ReceiptStatus } from '../receipt.model';
import { ReceiptService } from '../receipt.service';

@Component({
  selector: 'app-receipts-list',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, Pager],
  templateUrl: './receipts-list.html',
})
export class ReceiptsList implements OnInit {
  private readonly receiptService = inject(ReceiptService);
  private readonly auth = inject(AuthService);

  protected readonly ViewIcon = Package;
  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
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
          [r.code, r.supplier.name, r.waybillNumber ?? '', r.warehouse.code, r.warehouse.name].some((value) =>
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

  deleteDraft(receipt: Receipt): void {
    if (!confirm(`Delete draft ${receipt.code}?`)) {
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
