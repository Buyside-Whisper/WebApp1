import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { AppModule, Credentials, MODULE_LABELS } from '../../../../core/auth/auth.model';
import { CredentialsModal } from '../../../../shared/credentials-modal/credentials-modal';
import { Modal } from '../../../../shared/modal/modal';
import { Company } from '../company.model';
import { CompanyService } from '../company.service';

const ALL_MODULES: AppModule[] = ['wms', 'store', 'restaurant'];

@Component({
  selector: 'app-companies-page',
  imports: [CredentialsModal, DatePipe, FormsModule, LucideAngularModule, Modal],
  templateUrl: './companies-page.html',
  styleUrl: './companies-page.css',
})
export class CompaniesPage implements OnInit {
  private readonly companyService = inject(CompanyService);

  protected readonly PlusIcon = Plus;
  protected readonly modules = ALL_MODULES;
  protected readonly labels = MODULE_LABELS;

  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly credentials = signal<Credentials | null>(null);

  protected readonly isCreateOpen = signal(false);
  protected readonly newName = signal('');
  protected readonly newAdminFirstName = signal('');
  protected readonly newAdminLastName = signal('');
  protected readonly newModules = signal<AppModule[]>([]);
  protected readonly formError = signal('');

  protected readonly editing = signal<Company | null>(null);
  protected readonly editName = signal('');
  protected readonly editModules = signal<AppModule[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.companyService.list().subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load companies. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  openCreate(): void {
    this.newName.set('');
    this.newAdminFirstName.set('');
    this.newAdminLastName.set('');
    this.newModules.set([]);
    this.formError.set('');
    this.isCreateOpen.set(true);
  }

  toggle(list: WritableSignal<AppModule[]>, module: AppModule): void {
    list.update((current) =>
      current.includes(module) ? current.filter((m) => m !== module) : [...current, module],
    );
  }

  create(): void {
    if (
      !this.newName().trim() ||
      !this.newAdminFirstName().trim() ||
      !this.newAdminLastName().trim()
    ) {
      this.formError.set("Company name and the admin's first and last name are required.");
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');
    this.companyService
      .create({
        name: this.newName().trim(),
        adminFirstName: this.newAdminFirstName().trim(),
        adminLastName: this.newAdminLastName().trim(),
        modules: this.newModules(),
      })
      .subscribe({
        next: ({ credentials }) => {
          this.isSaving.set(false);
          this.isCreateOpen.set(false);
          this.credentials.set(credentials);
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.formError.set(messageOf(error, 'Could not create the company.'));
        },
      });
  }

  openEdit(company: Company): void {
    this.editing.set(company);
    this.editName.set(company.name);
    this.editModules.set([...company.modules]);
    this.formError.set('');
  }

  saveEdit(): void {
    const company = this.editing();
    if (!company || !this.editName().trim()) {
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');
    this.companyService
      .update(company.id, { name: this.editName().trim(), modules: this.editModules() })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.editing.set(null);
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.formError.set(messageOf(error, 'Could not save the company.'));
        },
      });
  }

  resetPassword(company: Company): void {
    if (
      !confirm(
        `Reset the system admin password of ${company.name}? The old password stops working.`,
      )
    ) {
      return;
    }
    this.companyService.resetAdminPassword(company.id).subscribe({
      next: (credentials) => this.credentials.set(credentials),
      error: () => this.errorMessage.set('Could not reset the password.'),
    });
  }

  remove(company: Company): void {
    if (
      !confirm(
        `Delete ${company.name} and ALL of its data (people, warehouses, sales, logins)? This cannot be undone.`,
      )
    ) {
      return;
    }
    this.companyService.remove(company.id).subscribe({
      next: () => this.load(),
      error: () => this.errorMessage.set('Could not delete the company.'),
    });
  }
}

function messageOf(error: HttpErrorResponse, fallback: string): string {
  const message = error.error?.message;
  return Array.isArray(message)
    ? message.join(', ')
    : typeof message === 'string'
      ? message
      : fallback;
}
