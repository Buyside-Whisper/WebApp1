import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowRight, LucideAngularModule, Package, PenLine, Plus, Search, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { TRANSFER_STATUS_LABELS, Transfer, TransferStatus } from '../transfer.model';
import { TransferService } from '../transfer.service';

@Component({
  selector: 'app-transfers-list',
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, Pager],
  templateUrl: './transfers-list.html',
})
export class TransfersList implements OnInit {
  private readonly transferService = inject(TransferService);
  private readonly auth = inject(AuthService);

  protected readonly ViewIcon = Package;
  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly ArrowIcon = ArrowRight;
  protected readonly statusLabels = TRANSFER_STATUS_LABELS;

  protected readonly canWrite = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'module_admin' || role === 'manager';
  });

  protected readonly transfers = signal<Transfer[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | TransferStatus>('all');
  protected readonly warehouseFilter = signal('all');

  protected readonly warehousesInList = computed(() => {
    const byId = new Map(this.transfers().flatMap((t) => [t.fromWarehouse, t.toWarehouse]).map((w) => [w.id, w]));
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  });

  protected readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.statusFilter() !== 'all' || this.warehouseFilter() !== 'all',
  );

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const warehouse = this.warehouseFilter();
    return this.transfers().filter(
      (t) =>
        (this.statusFilter() === 'all' || t.status === this.statusFilter()) &&
        (warehouse === 'all' || t.fromWarehouseId === warehouse || t.toWarehouseId === warehouse) &&
        (!query ||
          [t.code, t.fromWarehouse.code, t.fromWarehouse.name, t.toWarehouse.code, t.toWarehouse.name].some(
            (value) => value.toLowerCase().includes(query),
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
    this.transferService.list().subscribe({
      next: (transfers) => {
        this.transfers.set(transfers);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load transfers. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  deleteDraft(transfer: Transfer): void {
    if (!confirm(`Delete draft ${transfer.code}?`)) {
      return;
    }
    this.transferService.remove(transfer.id).subscribe({
      next: () => this.load(),
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the transfer.'),
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
    this.warehouseFilter.set('all');
  }
}
