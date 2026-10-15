import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { RECEIPT_STATUS_LABELS, Receipt } from '../receipt.model';
import { ReceiptService } from '../receipt.service';

// One receipt with its lines, and the actions its status allows: a draft can be edited, deleted or
// posted; a posted one can be cancelled.
@Component({
  selector: 'app-receipt-view',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './receipt-view.html',
})
export class ReceiptView implements OnInit {
  private readonly receiptService = inject(ReceiptService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly statusLabels = RECEIPT_STATUS_LABELS;
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly isBusy = signal(false);

  // The backend also checks the warehouse (a manager only sees his own receipts anyway).
  protected readonly canWrite = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'module_admin' || role === 'manager';
  });
  protected readonly canOpenProducts = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'system_admin' || role === 'module_admin';
  });

  ngOnInit(): void {
    this.receiptService.get(this.id()).subscribe({
      next: (receipt) => this.receipt.set(receipt),
      error: () => this.errorMessage.set('Could not load the receipt.'),
    });
  }

  post(): void {
    if (confirm('Post this receipt? The goods go into the warehouse and the receipt is locked.')) {
      this.run(this.receiptService.post(this.id()));
    }
  }

  cancel(): void {
    if (confirm('Cancel this receipt? Its goods are taken back out of the warehouse.')) {
      this.run(this.receiptService.cancel(this.id()));
    }
  }

  remove(): void {
    if (!confirm('Delete this draft?')) {
      return;
    }
    this.receiptService.remove(this.id()).subscribe({
      next: () => void this.router.navigate(['/wms/receipts']),
      error: (error: HttpErrorResponse) => this.errorMessage.set(error.error?.message ?? 'Could not delete it.'),
    });
  }

  private run(request: Observable<Receipt>): void {
    this.isBusy.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.isBusy.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isBusy.set(false);
        this.errorMessage.set(error.error?.message ?? 'Something went wrong.');
      },
    });
  }
}
