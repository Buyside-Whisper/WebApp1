import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Eye, LucideAngularModule, PenLine, Plus, Search } from 'lucide-angular';
import { MODULE_LABELS } from '../../../../core/auth/auth.model';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { BILLING_BADGES, BILLING_LABELS, BillingState, Company } from '../company.model';
import { CompanyService } from '../company.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-companies-page',
  imports: [TranslatePipe, DatePipe, DecimalPipe, FormsModule, LucideAngularModule, Pager, RouterLink],
  templateUrl: './companies-page.html',
  styleUrl: './companies-page.css',
})
export class CompaniesPage implements OnInit {
  private readonly companyService = inject(CompanyService);

  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;
  protected readonly ViewIcon = Eye;
  protected readonly EditIcon = PenLine;
  protected readonly labels = MODULE_LABELS;
  protected readonly billingLabels = BILLING_LABELS;
  protected readonly billingBadges = BILLING_BADGES;
  protected readonly billingStates = Object.keys(BILLING_LABELS) as BillingState[];

  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly billingFilter = signal<'all' | BillingState>('all');
  protected readonly hasFilters = computed(() => this.search().trim() !== '' || this.billingFilter() !== 'all');
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const state = this.billingFilter();
    return this.companies().filter(
      (c) =>
        (state === 'all' || c.billing.state === state) &&
        (!query ||
          [c.name, c.legalName, c.identificationCode, c.adminName, c.adminUsername].some((value) =>
            (value ?? '').toLowerCase().includes(query),
          )),
    );
  });
  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.billingFilter()],
  );

  protected readonly paying = computed(() => this.companies().filter((c) => c.status === 'active'));
  protected readonly monthlyRevenue = computed(() =>
    this.paying().reduce((sum, c) => sum + c.billing.monthlyTotal, 0),
  );
  protected readonly overdue = computed(() => this.companies().filter((c) => c.billing.state === 'overdue'));
  protected readonly blocked = computed(() => this.companies().filter((c) => c.status !== 'active').length);

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

  clearFilters(): void {
    this.search.set('');
    this.billingFilter.set('all');
  }

  showOverdue(): void {
    this.search.set('');
    this.billingFilter.set('overdue');
  }
}
