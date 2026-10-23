import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { LucideAngularModule, Plus, Search } from 'lucide-angular';
import { AppModule, Credentials, MODULE_LABELS } from '../../../../core/auth/auth.model';
import { AuthService } from '../../../../core/auth/auth.service';
import { CredentialsModal } from '../../../../shared/credentials-modal/credentials-modal';
import { Modal } from '../../../../shared/modal/modal';
import { StoreService } from '../../../store/stores/store.service';
import { WarehouseService } from '../../../wms/warehouses/warehouse.service';
import { EMPLOYEE_ROLE_LABELS, Employee, EmployeeRole, EmployeeStatus } from '../employee.model';
import { EmployeeService } from '../employee.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'personalId'
  | 'email'
  | 'phone'
  | 'position'
  | 'birthDate'
  | 'hireDate'
  | 'module';

const QUICK_ADD = true;
const QUICK_ADD_DISABLED = [
  'lastName',
  'personalId',
  'email',
  'phone',
  'birthDate',
  'hireDate',
  'endDate',
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  blank: 'This field is required.',
  email: 'Enter a valid email address.',
  personalId: 'Personal ID must be exactly 11 digits.',
  phone: 'Enter a valid phone number.',
  notInPast: 'Date of birth must be in the past.',
  moduleRequired: 'Choose a module for this role.',
};

@Component({
  selector: 'app-employees-list',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, 
    CredentialsModal,
    DatePipe,
    FormsModule,
    LucideAngularModule,
    Modal,
    ReactiveFormsModule,
  ],
  templateUrl: './employees-list.html',
  styleUrl: './employees-list.css',
})
export class EmployeesList implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly columnOrder = new ColumnOrder('hr-employees', [
    { key: 'employee', label: 'Employee' },
    { key: 'position', label: 'Position' },
    { key: 'personalId', label: 'Personal ID' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'role', label: 'Role' },
    { key: 'login', label: 'Login' },
    { key: 'status', label: 'Status' },
    { key: 'hireDate', label: 'Hire date' },
  ]);
  private readonly employeeService = inject(EmployeeService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);

  protected readonly roleLabels = EMPLOYEE_ROLE_LABELS;
  protected readonly moduleLabels = MODULE_LABELS;

  private readonly storeService = inject(StoreService);
  private readonly warehouseService = inject(WarehouseService);

  protected readonly isSystemAdmin = computed(() => this.auth.user()?.role === 'system_admin');
  protected readonly isManager = computed(() => this.auth.user()?.role === 'manager');

  protected readonly places = signal<{ id: string; name: string }[]>([]);
  protected readonly placeIds = signal<string[]>([]);
  protected readonly placeKind = computed(() =>
    this.auth.user()?.module === 'wms' ? 'warehouse' : 'store',
  );
  protected readonly ownModule = computed(() => this.auth.user()?.module ?? null);
  protected readonly availableModules = computed<AppModule[]>(
    () => this.auth.user()?.companyModules ?? [],
  );
  protected readonly availableRoles = computed<EmployeeRole[]>(() => {
    switch (this.auth.user()?.role) {
      case 'system_admin':
        return ['admin'];
      case 'module_admin':
        return ['manager'];
      default:
        return this.auth.user()?.module === 'store' ? ['cashier'] : [];
    }
  });

  protected readonly filterRoles = computed<EmployeeRole[]>(() => {
    switch (this.auth.user()?.role) {
      case 'system_admin':
        return ['admin', 'manager', 'cashier'];
      case 'module_admin':
        return ['manager', 'cashier'];
      default:
        return [];
    }
  });

  protected readonly credentials = signal<Credentials | null>(null);
  protected readonly loginError = signal('');

  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly today = localToday();

  protected readonly employees = signal<Employee[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isAddOpen = signal(false);
  protected readonly serverError = signal('');

  protected readonly search = signal('');
  protected readonly roleFilter = signal<'all' | 'none' | EmployeeRole>('all');

  protected readonly filteredEmployees = computed(() => {
    const query = this.search().trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, '');
    const role = this.roleFilter();

    return this.employees().filter((employee) => {
      if (role === 'none' ? employee.role !== null : role !== 'all' && employee.role !== role) {
        return false;
      }
      if (!query) {
        return true;
      }
      const texts = [
        `${employee.firstName} ${employee.lastName}`,
        employee.personalId,
        employee.email,
        employee.phone,
      ];
      const textMatch = texts.some((text) => text?.toLowerCase().includes(query));
      const phoneMatch =
        queryDigits.length >= 3 && !!employee.phone?.replace(/\D/g, '').includes(queryDigits);
      return textMatch || phoneMatch;
    });
  });

  protected readonly hasActiveFilters = computed(
    () => this.search().trim() !== '' || this.roleFilter() !== 'all',
  );

  clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('all');
  }

  protected readonly positions = computed(() =>
    uniqueSorted(this.employees().map((e) => e.position)),
  );

  protected readonly form = this.fb.group(
    {
      firstName: ['', notBlank],
      lastName: ['', notBlank],
      personalId: ['', [Validators.required, pattern(/^\d{11}$/, 'personalId')]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, pattern(/^\+?[0-9 ()-]{7,20}$/, 'phone')]],
      position: ['', notBlank],
      birthDate: ['', [Validators.required, inThePast]],
      hireDate: ['', Validators.required],
      endDate: [''],
      role: this.fb.control<EmployeeRole | ''>(''),
      module: this.fb.control<AppModule | null>(null),
    },
    { validators: [hireDateAfterBirth, endDateAfterHire, moduleForRole] },
  );

  protected formStatus(): EmployeeStatus {
    const endDate = this.form.controls.endDate.value;
    return endDate && endDate <= localToday() ? 'former' : 'active';
  }

  ngOnInit(): void {
    this.loadEmployees();
    if (this.isManager()) {
      if (this.placeKind() === 'warehouse') {
        this.warehouseService
          .list()
          .subscribe((list) =>
            this.places.set(list.map((w) => ({ id: w.id, name: `${w.code} ${w.name}` }))),
          );
      } else {
        this.storeService
          .list()
          .subscribe((list) => this.places.set(list.map((s) => ({ id: s.id, name: s.name }))));
      }
    }
  }

  private latestLoad = 0;

  loadEmployees(): void {
    const load = ++this.latestLoad;
    if (this.employees().length === 0) {
      this.isLoading.set(true);
    }
    this.employeeService.list().subscribe({
      next: (employees) => {
        if (load === this.latestLoad) {
          this.employees.set(employees);
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected readonly quickAdd = QUICK_ADD;
  protected readonly notice = signal('');

  private showNotice(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 4000);
  }

  openAddForm(): void {
    this.form.reset();
    this.form.controls.role.setValue(this.isSystemAdmin() ? '' : (this.availableRoles()[0] ?? ''));
    this.onRoleChange();
    this.placeIds.set(this.places().length === 1 ? [this.places()[0].id] : []);

    this.form.controls.module.setValue(this.ownModule() ?? null);
    if (QUICK_ADD) {
      this.form.patchValue(randomPersonDetails());
      for (const name of QUICK_ADD_DISABLED) {
        this.form.controls[name].disable();
      }
    }
    this.serverError.set('');
    this.isAddOpen.set(true);
  }

  closeAddForm(): void {
    this.isAddOpen.set(false);
  }

  protected errorFor(name: FieldName): string {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) {
      return '';
    }
    const key = Object.keys(control.errors)[0];
    return ERROR_MESSAGES[key] ?? 'Invalid value.';
  }

  protected moduleError(): string {
    return this.form.controls.module.touched && this.form.hasError('moduleRequired')
      ? ERROR_MESSAGES['moduleRequired']
      : '';
  }

  protected onRoleChange(): void {
    const role = this.form.controls.role.value;
    if (role === 'cashier') {
      this.form.controls.module.setValue('store');
    }
    if (this.isSystemAdmin() && role === '') {
      this.form.controls.module.setValue(null);
      this.form.controls.module.disable();
    } else {
      this.form.controls.module.enable();
    }
  }

  protected hireDateError(): string {
    return this.form.controls.hireDate.touched && this.form.hasError('hireBeforeBirth')
      ? 'Hire date cannot be before the date of birth.'
      : '';
  }

  protected endDateError(): string {
    return this.form.controls.endDate.touched && this.form.hasError('endBeforeHire')
      ? 'End date cannot be before the hire date.'
      : '';
  }

  togglePlace(place: { id: string }): void {
    this.serverError.set('');
    this.placeIds.update((ids) =>
      ids.includes(place.id) ? ids.filter((id) => id !== place.id) : [...ids, place.id],
    );
  }

  protected canManage(employee: Employee): boolean {
    return (
      this.auth.user()?.role !== 'module_admin' ||
      employee.role === 'manager' ||
      employee.role === null
    );
  }

  addEmployee(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isManager() && this.placeIds().length === 0) {
      this.serverError.set(this.i18n.t(this.placeKind() === 'store' ? 'Choose the stores this person works in.' : 'Choose the warehouses this person works in.'));
      return;
    }

    const value = this.form.getRawValue();

    this.isSaving.set(true);
    this.serverError.set('');
    this.employeeService
      .create({
        role: value.role || null,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        personalId: value.personalId.trim(),
        email: value.email.trim(),
        phone: value.phone.trim(),
        position: value.position.trim(),
        birthDate: value.birthDate,
        hireDate: value.hireDate,
        endDate: value.endDate || null,
        module: value.module,
        ...(this.isManager() ? { workplaceIds: this.placeIds() } : {}),
      })
      .subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.isAddOpen.set(false);
          this.employees.update((list) => [
            { ...created, username: created.username ?? null },
            ...list,
          ]);
          this.showNotice(this.i18n.t('Added {firstName} {lastName}', { firstName: created.firstName, lastName: created.lastName }));
          if (created.role && created.status === 'active') {
            this.issueLogin(created);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          const message = error.error?.message;
          this.serverError.set(
            Array.isArray(message)
              ? message.join(', ')
              : typeof message === 'string'
                ? message
                : 'Could not add the employee. Is the backend running?',
          );
        },
      });
  }

  protected canHaveLogin(employee: Employee): boolean {
    return employee.role !== null && employee.status === 'active';
  }

  issueLogin(employee: Employee): void {
    if (
      employee.username &&
      !this.i18n.confirm(
        this.i18n.t('Reset the password of {firstName} {lastName}? The old password stops working.', { firstName: employee.firstName, lastName: employee.lastName }),
      )
    ) {
      return;
    }
    this.loginError.set('');
    this.employeeService.issueCredentials(employee.id).subscribe({
      next: (credentials) => {
        this.credentials.set(credentials);
        this.loadEmployees();
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message;
        this.loginError.set(typeof message === 'string' ? message : 'Could not issue the login.');
      },
    });
  }

  deleteEmployee(employee: Employee): void {
    if (!this.i18n.confirm(this.i18n.t('Remove {firstName} {lastName}?', { firstName: employee.firstName, lastName: employee.lastName }))) {
      return;
    }
    this.employeeService.remove(employee.id).subscribe(() => this.loadEmployees());
  }
}

function randomPersonDetails() {
  const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
  const digits = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  const lastName = pick([
    'Beridze',
    'Kapanadze',
    'Gelashvili',
    'Chikovani',
    'Lomidze',
    'Abashidze',
    'Meladze',
    'Tsiklauri',
    'Shengelia',
    'Javakhishvili',
    'Gvelesiani',
    'Kvaratskhelia',
  ]);
  const birthYear = 1975 + Math.floor(Math.random() * 28);
  const hireYear = birthYear + 20 + Math.floor(Math.random() * 6);
  const date = (year: number) =>
    `${Math.min(year, new Date().getFullYear() - 1)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`;

  return {
    lastName,
    personalId: digits(11),
    email: `${lastName.toLowerCase()}.${digits(4)}@example.com`,
    phone: `+995 5${digits(2)} ${digits(2)} ${digits(2)} ${digits(2)}`,

    birthDate: date(birthYear),
    hireDate: date(hireYear),
    endDate: '',
  };
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

function moduleForRole(group: AbstractControl): ValidationErrors | null {
  const role = group.get('role')?.value as string;
  const module = group.get('module')?.value as string;
  return role && !module ? { moduleRequired: true } : null;
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { blank: true };
}

function pattern(regex: RegExp, errorKey: string) {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    !control.value || regex.test(control.value.trim()) ? null : { [errorKey]: true };
}

function inThePast(control: AbstractControl<string>): ValidationErrors | null {
  return !control.value || control.value < localToday() ? null : { notInPast: true };
}

function hireDateAfterBirth(group: AbstractControl): ValidationErrors | null {
  const birth = group.get('birthDate')?.value as string;
  const hire = group.get('hireDate')?.value as string;
  return birth && hire && hire < birth ? { hireBeforeBirth: true } : null;
}

function endDateAfterHire(group: AbstractControl): ValidationErrors | null {
  const hire = group.get('hireDate')?.value as string;
  const end = group.get('endDate')?.value as string;
  return hire && end && end < hire ? { endBeforeHire: true } : null;
}

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
