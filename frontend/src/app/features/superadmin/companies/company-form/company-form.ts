import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppModule, Credentials, MODULE_LABELS } from '../../../../core/auth/auth.model';
import { CredentialsModal } from '../../../../shared/credentials-modal/credentials-modal';
import {
  CompanyDetail,
  CompanyProfilePayload,
  LEGAL_FORM_LABELS,
  LegalForm,
  addDays,
  todayIso,
} from '../company.model';
import { CompanyService } from '../company.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

const ALL_MODULES: AppModule[] = ['wms', 'store', 'restaurant'];
const TRIAL_DAYS = 14;

const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  blank: 'This field is required.',
  email: 'Enter a valid email address.',
  phone: 'Enter a valid phone number.',
  code: 'The identification code has 9 digits.',
  personalCode: 'An individual entrepreneur uses the 11-digit personal ID.',
};

type FieldName =
  | 'name'
  | 'legalName'
  | 'identificationCode'
  | 'legalAddress'
  | 'contactEmail'
  | 'contactPhone'
  | 'adminFirst'
  | 'adminLast'
  | 'subscriptionStart'
  | 'trialEndsOn';

@Component({
  selector: 'app-company-form',
  imports: [TranslatePipe, CredentialsModal, ReactiveFormsModule, RouterLink],
  templateUrl: './company-form.html',
  styleUrl: './company-form.css',
})
export class CompanyForm implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly modules = ALL_MODULES;
  protected readonly moduleLabels = MODULE_LABELS;
  protected readonly legalForms = Object.entries(LEGAL_FORM_LABELS) as [LegalForm, string][];

  protected readonly id = signal<string | null>(null);
  protected readonly company = signal<CompanyDetail | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly credentials = signal<Credentials | null>(null);
  protected readonly selected = signal<AppModule[]>([]);
  private createdId: string | null = null;

  protected readonly form = this.fb.group(
    {
      name: ['', notBlank],
      legalForm: this.fb.control<LegalForm>('llc'),
      legalName: ['', notBlank],
      identificationCode: ['', Validators.required],
      vatPayer: this.fb.control(false),
      legalAddress: ['', notBlank],
      adminFirst: ['', notBlank],
      adminLast: ['', notBlank],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.required, pattern(/^\+?[0-9 ()-]{7,20}$/, 'phone')]],
      subscriptionStart: [todayIso(), Validators.required],
      hasTrial: this.fb.control(false),
      trialEndsOn: [''],
      notes: [''],
      prices: this.fb.group({
        wms: this.fb.control<number | null>(null),
        store: this.fb.control<number | null>(null),
        restaurant: this.fb.control<number | null>(null),
      }),
    },
    { validators: codeMatchesLegalForm },
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.id.set(id);
    this.form.controls.adminFirst.disable();
    this.form.controls.adminLast.disable();
    this.isLoading.set(true);
    this.companyService.get(id).subscribe({
      next: (company) => {
        this.company.set(company);
        this.fill(company);
        this.isLoading.set(false);
      },
      error: () => {
        this.formError.set('Could not load the company.');
        this.isLoading.set(false);
      },
    });
  }

  protected toggleModule(module: AppModule): void {
    this.selected.update((list) =>
      list.includes(module) ? list.filter((m) => m !== module) : [...list, module],
    );
  }

  protected toggleTrial(): void {
    const { hasTrial, trialEndsOn, subscriptionStart } = this.form.controls;
    if (hasTrial.value && !trialEndsOn.value) {
      trialEndsOn.setValue(addDays(subscriptionStart.value || todayIso(), TRIAL_DAYS));
    }
  }

  protected monthlyTotal(): number {
    const prices = this.form.controls.prices.getRawValue();
    return this.selected().reduce((sum, module) => sum + (Number(prices[module]) || 0), 0);
  }

  protected errorFor(name: FieldName): string {
    const control = this.form.controls[name];
    if (!control.touched) {
      return '';
    }
    if (name === 'identificationCode' && control.valid && this.form.errors?.['codeLength']) {
      return ERROR_MESSAGES[this.form.errors['codeLength']];
    }
    if (name === 'trialEndsOn' && this.form.controls.hasTrial.value) {
      const { subscriptionStart, trialEndsOn } = this.form.getRawValue();
      if (!trialEndsOn) {
        return ERROR_MESSAGES['required'];
      }
      if (trialEndsOn < subscriptionStart) {
        return 'The trial cannot end before the subscription starts.';
      }
    }
    if (!control.errors) {
      return '';
    }
    const key = Object.keys(control.errors)[0];
    return ERROR_MESSAGES[key] ?? 'Invalid value.';
  }

  protected priceError(module: AppModule): string {
    const control = this.form.controls.prices.controls[module];
    if (!control.touched) {
      return '';
    }
    const value = control.value;
    if (value === null || (value as unknown) === '') {
      return 'Enter the monthly price (0 is allowed).';
    }
    if (value < 0) {
      return 'The price cannot be negative.';
    }
    return '';
  }

  save(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const priceProblem = this.selected().some((module) => {
      const price = value.prices[module];
      return price === null || (price as unknown) === '' || Number(price) < 0;
    });
    const trialProblem = value.hasTrial && (!value.trialEndsOn || value.trialEndsOn < value.subscriptionStart);
    if (this.form.invalid || priceProblem || trialProblem) {
      this.formError.set('Please fix the highlighted fields.');
      return;
    }

    const profile: CompanyProfilePayload = {
      name: value.name.trim(),
      legalForm: value.legalForm,
      legalName: value.legalName.trim(),
      identificationCode: value.identificationCode.trim(),
      vatPayer: value.vatPayer,
      legalAddress: value.legalAddress.trim(),
      contactEmail: value.contactEmail.trim(),
      contactPhone: value.contactPhone.trim(),
      modules: this.selected(),
      modulePrices: Object.fromEntries(this.selected().map((module) => [module, Number(value.prices[module])])),
      subscriptionStart: value.subscriptionStart,
      trialEndsOn: value.hasTrial ? value.trialEndsOn : null,
      notes: value.notes.trim() || null,
    };

    this.isSaving.set(true);
    this.formError.set('');
    const id = this.id();
    if (id) {
      this.companyService.update(id, profile).subscribe({
        next: () => void this.router.navigate(['/superadmin/companies', id]),
        error: (error: HttpErrorResponse) => this.fail(error, 'Could not save the company.'),
      });
      return;
    }
    this.companyService
      .create({ ...profile, adminFirstName: value.adminFirst.trim(), adminLastName: value.adminLast.trim() })
      .subscribe({
        next: ({ company, credentials }) => {
          this.isSaving.set(false);
          this.createdId = company.id;
          this.credentials.set(credentials);
        },
        error: (error: HttpErrorResponse) => this.fail(error, 'Could not create the company.'),
      });
  }

  protected credentialsClosed(): void {
    this.credentials.set(null);
    void this.router.navigate(['/superadmin/companies', this.createdId]);
  }

  private fill(company: CompanyDetail): void {
    const [first, ...rest] = (company.adminName ?? '').split(' ');
    this.form.patchValue({
      name: company.name,
      legalForm: company.legalForm ?? 'llc',
      legalName: company.legalName ?? '',
      identificationCode: company.identificationCode ?? '',
      vatPayer: company.vatPayer,
      legalAddress: company.legalAddress ?? '',
      adminFirst: first ?? '',
      adminLast: rest.join(' '),
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      subscriptionStart: company.subscriptionStart ?? company.createdAt.slice(0, 10),
      hasTrial: !!company.trialEndsOn,
      trialEndsOn: company.trialEndsOn ?? '',
      notes: company.notes ?? '',
      prices: {
        wms: company.modulePrices.wms ?? null,
        store: company.modulePrices.store ?? null,
        restaurant: company.modulePrices.restaurant ?? null,
      },
    });
    this.selected.set([...company.modules]);
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.isSaving.set(false);
    const message = error.error?.message;
    this.formError.set(
      Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback,
    );
  }
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { blank: true };
}

function pattern(regex: RegExp, errorKey: string) {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    !control.value || regex.test(control.value.trim()) ? null : { [errorKey]: true };
}

function codeMatchesLegalForm(group: AbstractControl): ValidationErrors | null {
  const code = String(group.get('identificationCode')?.value ?? '').trim();
  if (!code) {
    return null;
  }
  const isPerson = group.get('legalForm')?.value === 'individual_entrepreneur';
  const ok = isPerson ? /^\d{11}$/.test(code) : /^\d{9}$/.test(code);
  return ok ? null : { codeLength: isPerson ? 'personalCode' : 'code' };
}
