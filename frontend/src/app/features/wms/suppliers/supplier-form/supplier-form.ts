import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Supplier, SupplierPayload, SupplierStatus, SupplierType } from '../supplier.model';
import { SupplierService } from '../supplier.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-supplier-form',
  imports: [TranslatePipe, FormsModule],
  templateUrl: './supplier-form.html',
})
export class SupplierForm implements OnInit {
  private readonly supplierService = inject(SupplierService);

  readonly supplier = input<Supplier | null>(null);
  readonly initial = input<Partial<SupplierPayload> | null>(null);
  readonly hint = input('');
  readonly saved = output<Supplier>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly name = signal('');
  protected readonly type = signal<SupplierType>('company');
  protected readonly identificationCode = signal('');
  protected readonly vatPayer = signal(false);
  protected readonly contactPerson = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly address = signal('');
  protected readonly status = signal<SupplierStatus>('active');

  ngOnInit(): void {
    const values = this.supplier() ?? this.initial();
    this.name.set(values?.name ?? '');
    this.type.set(values?.type ?? 'company');
    this.identificationCode.set(values?.identificationCode ?? '');
    this.vatPayer.set(values?.vatPayer ?? false);
    this.contactPerson.set(values?.contactPerson ?? '');
    this.phone.set(values?.phone ?? '');
    this.email.set(values?.email ?? '');
    this.address.set(values?.address ?? '');
    this.status.set(values?.status ?? 'active');
  }

  save(): void {
    const code = this.identificationCode().trim();
    if (!this.name().trim()) {
      this.formError.set('The supplier name is required.');
      return;
    }
    const length = this.type() === 'company' ? 9 : 11;
    if (code && !new RegExp(`^\\d{${length}}$`).test(code)) {
      this.formError.set(
        this.type() === 'company'
          ? "A company's identification code has 9 digits."
          : "An individual's identification code is the 11-digit personal ID.",
      );
      return;
    }
    const payload = {
      name: this.name().trim(),
      type: this.type(),
      identificationCode: code || null,
      vatPayer: this.vatPayer(),
      contactPerson: this.contactPerson().trim() || null,
      phone: this.phone().trim() || null,
      email: this.email().trim() || null,
      address: this.address().trim() || null,
      status: this.status(),
    };
    const id = this.supplier()?.id;
    const request = id ? this.supplierService.update(id, payload) : this.supplierService.create(payload);
    this.isSaving.set(true);
    this.formError.set('');
    request.subscribe({
      next: (supplier) => {
        this.isSaving.set(false);
        this.saved.emit(supplier);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.formError.set(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Could not save the supplier.',
        );
      },
    });
  }
}
