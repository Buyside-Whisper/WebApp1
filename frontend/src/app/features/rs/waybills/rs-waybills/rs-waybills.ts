import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Eye, LucideAngularModule, RefreshCw, Search } from 'lucide-angular';
import { canAccessModule } from '../../../../core/auth/access';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { RsTabs } from '../rs-tabs/rs-tabs';
import {
  RS_CONFIRMATION_BADGES,
  RS_INTERNAL_TYPE,
  RS_PURCHASE_TYPES,
  RS_CONFIRMATION_LABELS,
  RS_STATUS_BADGES,
  RS_STATUS_LABELS,
  RsConfirmation,
  RsConnection,
  RsDocumentLink,
  RsWarehouseChoice,
  RsWaybillDetail,
  RsWaybillSummary,
} from '../rs.model';
import { RsService } from '../rs.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

@Component({
  selector: 'app-rs-waybills',
  imports: [TranslatePipe, DatePipe, DecimalPipe, FormsModule, LucideAngularModule, Modal, Pager, RouterLink, RsTabs],
  templateUrl: './rs-waybills.html',
  styleUrl: './rs-waybills.css',
})
export class RsWaybills implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly rsService = inject(RsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isSystemAdmin = computed(() => this.auth.user()?.role === 'system_admin');
  protected readonly canSeeReceipts = computed(() => {
    const user = this.auth.user();
    return !!user && canAccessModule(user, 'wms') && (user.role === 'system_admin' || user.role === 'module_admin');
  });
  protected readonly canCreateReceipts = computed(
    () => this.auth.user()?.role === 'module_admin' && this.auth.user()?.module === 'wms',
  );
  protected readonly links = signal(new Map<string, RsDocumentLink>());
  protected readonly transferFor = signal<RsWaybillSummary | null>(null);
  protected readonly fromWarehouseId = signal('');
  protected readonly toWarehouseId = signal('');
  protected readonly activeWarehouses = computed(() => this.warehouses().filter((w) => w.status === 'active'));

  protected readonly receiptFor = signal<RsWaybillSummary | null>(null);
  protected readonly warehouses = signal<RsWarehouseChoice[]>([]);
  protected readonly warehouseId = signal('');
  protected readonly isCreating = signal(false);
  protected readonly createError = signal('');
  protected readonly myWarehouses = computed(() => this.warehouses().filter((w) => w.mine && w.status === 'active'));
  protected readonly statusLabels = RS_STATUS_LABELS;
  protected readonly statusBadges = RS_STATUS_BADGES;
  protected readonly confirmationLabels = RS_CONFIRMATION_LABELS;
  protected readonly confirmationBadges = RS_CONFIRMATION_BADGES;
  protected readonly SearchIcon = Search;
  protected readonly ViewIcon = Eye;
  protected readonly RefreshIcon = RefreshCw;
  protected readonly quickPeriods = [
    { label: 'Today', days: 0 },
    { label: '7 days', days: 6 },
    { label: '30 days', days: 29 },
    { label: '90 days', days: 89 },
  ];

  protected readonly connection = signal<RsConnection | null>(null);
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(todayIso());
  protected readonly loadedPeriod = signal<{ from: string; to: string } | null>(null);
  protected readonly activeQuickPeriod = computed(
    () => this.quickPeriods.find((p) => this.to() === todayIso() && this.from() === daysAgo(p.days))?.days ?? null,
  );
  protected readonly waybills = signal<RsWaybillSummary[]>([]);
  protected readonly fetchedAt = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly typeFilter = signal('all');
  protected readonly statusFilter = signal('all');
  protected readonly confirmationFilter = signal<'all' | RsConfirmation>('all');

  protected readonly types = computed(() =>
    [...new Set(this.waybills().map((w) => w.typeName ?? 'Unknown'))].sort((a, b) => a.localeCompare(b)),
  );
  protected readonly statuses = computed(() =>
    [...new Set(this.waybills().map((w) => String(w.status)))].sort((a, b) => Number(b) - Number(a)),
  );
  protected readonly hasFilters = computed(
    () =>
      this.search().trim() !== '' ||
      this.typeFilter() !== 'all' ||
      this.statusFilter() !== 'all' ||
      this.confirmationFilter() !== 'all',
  );
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const status = this.statusFilter();
    const confirmation = this.confirmationFilter();
    return this.waybills().filter(
      (w) =>
        (type === 'all' || (w.typeName ?? 'Unknown') === type) &&
        (status === 'all' || String(w.status) === status) &&
        (confirmation === 'all' || w.confirmation === confirmation) &&
        (!query ||
          [w.number, w.sellerName, w.sellerTin, w.startAddress, w.endAddress, w.carNumber, w.driverName].some(
            (value) => (value ?? '').toLowerCase().includes(query),
          )),
    );
  });
  protected readonly totalAmount = computed(() => this.filtered().reduce((sum, w) => sum + w.amount, 0));
  protected readonly waiting = computed(() => this.waybills().filter((w) => w.confirmation === 'pending').length);
  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.typeFilter(), this.statusFilter(), this.confirmationFilter(), this.waybills()],
  );

  protected readonly detail = signal<RsWaybillDetail | null>(null);
  protected readonly detailFor = signal<RsWaybillSummary | null>(null);
  protected readonly detailError = signal('');

  ngOnInit(): void {
    this.rsService.connection().subscribe({
      next: (connection) => {
        this.connection.set(connection);
        if (connection.connected) {
          this.load();
        }
      },
      error: () => this.errorMessage.set('Could not reach the backend. Is it running?'),
    });
  }

  setQuickPeriod(days: number): void {
    this.from.set(daysAgo(days));
    this.to.set(todayIso());
    this.load();
  }

  load(refresh = false): void {
    if (!this.from() || !this.to()) {
      this.errorMessage.set('Choose both dates.');
      return;
    }
    if (this.to() < this.from()) {
      this.errorMessage.set('The period must end on or after the day it starts.');
      return;
    }
    const period = { from: this.from(), to: this.to() };
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.rsService.received(period.from, period.to, refresh).subscribe({
      next: (list) => {
        this.loadLinks();
        this.waybills.set(list.waybills);
        this.fetchedAt.set(list.fetchedAt);
        this.loadedPeriod.set(period);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        const message = error.error?.message;
        this.errorMessage.set(typeof message === 'string' ? message : 'Could not load the waybills from RS.');
      },
    });
  }

  protected linkFor(waybill: RsWaybillSummary): RsDocumentLink | undefined {
    return this.links().get(waybill.id);
  }

  protected canReceive(waybill: RsWaybillSummary): boolean {
    return (
      this.canCreateReceipts() &&
      !this.linkFor(waybill) &&
      waybill.typeId !== null &&
      RS_PURCHASE_TYPES.includes(waybill.typeId) &&
      (waybill.status === 1 || waybill.status === 2) &&
      waybill.confirmation !== 'rejected'
    );
  }

  protected canTransfer(waybill: RsWaybillSummary): boolean {
    return (
      this.canCreateReceipts() &&
      !this.linkFor(waybill) &&
      waybill.typeId === RS_INTERNAL_TYPE &&
      (waybill.status === 1 || waybill.status === 2) &&
      !!waybill.sellerTin &&
      waybill.sellerTin === waybill.buyerTin
    );
  }

  startTransfer(waybill: RsWaybillSummary): void {
    this.transferFor.set(waybill);
    this.createError.set('');
    this.fromWarehouseId.set('');
    this.toWarehouseId.set('');
    if (this.warehouses().length === 0) {
      this.rsService.warehouses().subscribe({
        next: (warehouses) => this.warehouses.set(warehouses),
        error: () => this.createError.set('Could not load your warehouses.'),
      });
    }
  }

  createTransfer(): void {
    const waybill = this.transferFor();
    if (!waybill || !this.fromWarehouseId() || !this.toWarehouseId()) {
      this.createError.set('Choose where the goods leave from and where they go.');
      return;
    }
    if (this.fromWarehouseId() === this.toWarehouseId()) {
      this.createError.set('Choose two different warehouses.');
      return;
    }
    this.isCreating.set(true);
    this.createError.set('');
    this.rsService.createTransfer(waybill.id, this.fromWarehouseId(), this.toWarehouseId()).subscribe({
      next: (transfer) => {
        this.isCreating.set(false);
        void this.router.navigate(['/wms/transfers', transfer.id, 'edit']);
      },
      error: (error: HttpErrorResponse) => {
        this.isCreating.set(false);
        const body = error.error ?? {};
        if (error.status === 409 && body.transferId) {
          void this.router.navigate(['/wms/transfers', body.transferId]);
        } else {
          this.createError.set(typeof body.message === 'string' ? body.message : 'Could not create the transfer.');
        }
      },
    });
  }

  protected linkRoute(link: RsDocumentLink): string[] {
    return [link.kind === 'receipt' ? '/wms/receipts' : '/wms/transfers', link.id];
  }

  protected canReject(waybill: RsWaybillSummary): boolean {
    const link = this.linkFor(waybill);
    return (
      this.canCreateReceipts() &&
      waybill.typeId !== null &&
      RS_PURCHASE_TYPES.includes(waybill.typeId) &&
      waybill.confirmation === 'pending' &&
      (waybill.status === 1 || waybill.status === 2) &&
      (!link || (link.kind === 'receipt' && !link.posted))
    );
  }

  startReceipt(waybill: RsWaybillSummary): void {
    this.receiptFor.set(waybill);
    this.createError.set('');
    if (this.warehouses().length === 0) {
      this.rsService.warehouses().subscribe({
        next: (warehouses) => {
          this.warehouses.set(warehouses);
          if (this.myWarehouses().length === 1) {
            this.warehouseId.set(this.myWarehouses()[0].id);
          }
        },
        error: () => this.createError.set('Could not load your warehouses.'),
      });
    }
  }

  createReceipt(): void {
    const waybill = this.receiptFor();
    if (!waybill || !this.warehouseId()) {
      this.createError.set('Choose the warehouse the goods arrive in.');
      return;
    }
    this.isCreating.set(true);
    this.createError.set('');
    this.rsService.createReceipt(waybill.id, this.warehouseId()).subscribe({
      next: (receipt) => {
        this.isCreating.set(false);
        void this.router.navigate(['/wms/receipts', receipt.id, 'edit']);
      },
      error: (error: HttpErrorResponse) => {
        this.isCreating.set(false);
        const body = error.error ?? {};
        if (error.status === 409 && body.receiptId) {
          void this.router.navigate(['/wms/receipts', body.receiptId]);
        } else {
          this.createError.set(typeof body.message === 'string' ? body.message : 'Could not create the receipt.');
        }
      },
    });
  }

  reject(waybill: RsWaybillSummary): void {
    const link = this.linkFor(waybill);
    const question =
      this.i18n.t('Reject waybill {number} from {value} in RS (უარყოფილი)?', { number: waybill.number, value: waybill.sellerName ?? waybill.sellerTin }) +
      (link ? this.i18n.t(' The draft {code} is deleted.', { code: link.code }) : '') +
      this.i18n.t(' Do this only if the goods were not delivered or the waybill is wrong.');
    if (!this.i18n.confirm(question)) {
      return;
    }
    this.rsService.reject(waybill.id).subscribe({
      next: () => {
        this.close();
        this.load(true);
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message;
        this.detailError.set(typeof message === 'string' ? message : 'Could not reject the waybill in RS.');
      },
    });
  }

  private loadLinks(): void {
    if (!this.canSeeReceipts()) {
      return;
    }
    const labels: Record<string, string> = {
      draft: 'Draft',
      posted: 'Posted',
      in_transit: 'In transit',
      received: 'Received',
    };
    forkJoin([this.rsService.receiptLinks(), this.rsService.transferLinks()]).subscribe({
      next: ([receipts, transfers]) =>
        this.links.set(
          new Map<string, RsDocumentLink>([
            ...receipts.map((r): [string, RsDocumentLink] => [
              r.rsWaybillId,
              { kind: 'receipt', id: r.receiptId, code: r.code, statusLabel: labels[r.status], posted: r.status !== 'draft' },
            ]),
            ...transfers.map((t): [string, RsDocumentLink] => [
              t.rsWaybillId,
              { kind: 'transfer', id: t.transferId, code: t.code, statusLabel: labels[t.status], posted: t.status !== 'draft' },
            ]),
          ]),
        ),
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set('all');
    this.statusFilter.set('all');
    this.confirmationFilter.set('all');
  }

  open(waybill: RsWaybillSummary): void {
    this.detailFor.set(waybill);
    this.detail.set(null);
    this.detailError.set('');
    this.rsService.waybill(waybill.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message;
        this.detailError.set(typeof message === 'string' ? message : 'Could not load the waybill from RS.');
      },
    });
  }

  close(): void {
    this.detailFor.set(null);
    this.detail.set(null);
  }

  protected statusLabel(status: number | null): string {
    return this.statusLabels[String(status)] ?? this.i18n.t('Status {value}', { value: status ?? '?' });
  }

  protected statusBadge(status: number | null): string {
    return this.statusBadges[String(status)] ?? 'badge--inactive';
  }
}
