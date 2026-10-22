import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { Credentials, MODULE_LABELS } from '../../../../core/auth/auth.model';
import { CredentialsModal } from '../../../../shared/credentials-modal/credentials-modal';
import { Modal } from '../../../../shared/modal/modal';
import {
  BILLING_BADGES,
  BILLING_LABELS,
  CompanyDetail,
  CompanyPayment,
  CompanyStatus,
  LEGAL_FORM_LABELS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  addDays,
  addMonths,
  todayIso,
} from '../company.model';
import { CompanyService } from '../company.service';

@Component({
  selector: 'app-company-view',
  imports: [CredentialsModal, DatePipe, DecimalPipe, FormsModule, LucideAngularModule, Modal, RouterLink],
  templateUrl: './company-view.html',
  styleUrl: './company-view.css',
})
export class CompanyView implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly moduleLabels = MODULE_LABELS;
  protected readonly legalFormLabels = LEGAL_FORM_LABELS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly methods = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
  protected readonly billingLabels = BILLING_LABELS;
  protected readonly billingBadges = BILLING_BADGES;
  protected readonly DeleteIcon = Trash2;

  protected readonly company = signal<CompanyDetail | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly credentials = signal<Credentials | null>(null);

  protected readonly isPaymentOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly paymentError = signal('');
  protected readonly months = signal(1);
  protected readonly paidOn = signal(todayIso());
  protected readonly periodFrom = signal(todayIso());
  protected readonly periodTo = signal(todayIso());
  protected readonly amount = signal(0);
  protected readonly method = signal<PaymentMethod>('bank_transfer');
  protected readonly reference = signal('');
  protected readonly note = signal('');

  protected readonly incomplete = computed(() => {
    const company = this.company();
    return !!company && (!company.legalName || !company.identificationCode || !company.contactEmail);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.isLoading.set(true);
    this.companyService.get(id).subscribe({
      next: (company) => {
        this.company.set(company);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load the company. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  openPayment(): void {
    const company = this.company()!;
    this.months.set(1);
    this.paidOn.set(todayIso());
    this.periodFrom.set(company.billing.nextDue);
    this.method.set('bank_transfer');
    this.reference.set('');
    this.note.set('');
    this.paymentError.set('');
    this.applyMonths(1);
    this.isPaymentOpen.set(true);
  }

  applyMonths(months: number): void {
    this.months.set(months);
    if (months > 0) {
      this.periodTo.set(addDays(addMonths(this.periodFrom(), months), -1));
      this.amount.set(Math.round(this.company()!.billing.monthlyTotal * months * 100) / 100);
    }
  }

  changePeriodFrom(date: string): void {
    this.periodFrom.set(date);
    if (this.months() > 0) {
      this.applyMonths(this.months());
    }
  }

  savePayment(): void {
    const company = this.company()!;
    if (!this.paidOn() || !this.periodFrom() || !this.periodTo()) {
      this.paymentError.set('Fill in the payment date and the period.');
      return;
    }
    if (this.periodTo() < this.periodFrom()) {
      this.paymentError.set('The period must end on or after the day it starts.');
      return;
    }
    if (!(Number(this.amount()) > 0)) {
      this.paymentError.set('Enter the amount received.');
      return;
    }
    this.isSaving.set(true);
    this.paymentError.set('');
    this.companyService
      .addPayment(company.id, {
        paidOn: this.paidOn(),
        amount: Math.round(Number(this.amount()) * 100) / 100,
        method: this.method(),
        periodFrom: this.periodFrom(),
        periodTo: this.periodTo(),
        reference: this.reference().trim() || null,
        note: this.note().trim() || null,
      })
      .subscribe({
        next: (updated) => {
          this.isSaving.set(false);
          this.isPaymentOpen.set(false);
          this.company.set(updated);
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.paymentError.set(messageOf(error, 'Could not record the payment.'));
        },
      });
  }

  removePayment(payment: CompanyPayment): void {
    if (!confirm(`Delete the ₾${payment.amount.toFixed(2)} payment for ${payment.periodFrom} – ${payment.periodTo}?`)) {
      return;
    }
    this.companyService.removePayment(this.company()!.id, payment.id).subscribe({
      next: (updated) => this.company.set(updated),
      error: (error: HttpErrorResponse) => this.errorMessage.set(messageOf(error, 'Could not delete the payment.')),
    });
  }

  setStatus(status: CompanyStatus): void {
    const company = this.company()!;
    const question = {
      suspended: `Suspend ${company.name}? Its users are signed out and can't log in until you reactivate it. No data is deleted.`,
      cancelled: `Cancel ${company.name}'s subscription? Its users can't log in any more. No data is deleted; you can reactivate it later.`,
      active: `Reactivate ${company.name}? Its users can log in again.`,
    }[status];
    if (!confirm(question)) {
      return;
    }
    this.companyService.update(company.id, { status }).subscribe({
      next: (updated) => this.company.set(updated),
      error: (error: HttpErrorResponse) => this.errorMessage.set(messageOf(error, 'Could not change the status.')),
    });
  }

  resetPassword(): void {
    const company = this.company()!;
    if (!confirm(`Reset the system admin password of ${company.name}? The old password stops working.`)) {
      return;
    }
    this.companyService.resetAdminPassword(company.id).subscribe({
      next: (credentials) => this.credentials.set(credentials),
      error: () => this.errorMessage.set('Could not reset the password.'),
    });
  }

  remove(): void {
    const company = this.company()!;
    if (
      !confirm(
        `Delete ${company.name} and ALL of its data (people, warehouses, sales, logins, payments)? This cannot be undone. To stop access but keep the data, cancel the subscription instead.`,
      )
    ) {
      return;
    }
    this.companyService.remove(company.id).subscribe({
      next: () => void this.router.navigateByUrl('/superadmin/companies'),
      error: () => this.errorMessage.set('Could not delete the company.'),
    });
  }
}

function messageOf(error: HttpErrorResponse, fallback: string): string {
  const message = error.error?.message;
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback;
}
