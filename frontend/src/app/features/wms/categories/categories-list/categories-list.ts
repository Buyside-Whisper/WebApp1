import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, PenLine, Plus, Search, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { Pager } from '../../../../shared/pager/pager';
import { Pagination } from '../../../../shared/pager/pagination';
import { ProductTabs } from '../../products/product-tabs/product-tabs';
import { Category, CategoryStatus } from '../category.model';
import { CategoryService } from '../category.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-categories-list',
  imports: [TranslatePipe, FormsModule, LucideAngularModule, Modal, Pager, ProductTabs],
  templateUrl: './categories-list.html',
})
export class CategoriesList implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly categoryService = inject(CategoryService);
  private readonly auth = inject(AuthService);

  protected readonly canManage = computed(() => this.auth.user()?.role === 'module_admin');

  protected readonly EditIcon = PenLine;
  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;
  protected readonly SearchIcon = Search;

  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | CategoryStatus>('all');
  protected readonly hasFilters = computed(() => this.search().trim() !== '' || this.statusFilter() !== 'all');
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.categories().filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (!query || [c.name, c.description ?? ''].some((value) => value.toLowerCase().includes(query))),
    );
  });
  protected readonly pages = new Pagination(
    () => this.filtered(),
    () => [this.search(), this.statusFilter()],
  );

  protected readonly isFormOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly status = signal<CategoryStatus>('active');

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.categoryService.list().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load categories. Is the backend running?');
        this.isLoading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
  }

  openAddForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.description.set('');
    this.status.set('active');
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  editCategory(category: Category): void {
    this.editingId.set(category.id);
    this.name.set(category.name);
    this.description.set(category.description ?? '');
    this.status.set(category.status);
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  saveCategory(): void {
    if (!this.name().trim()) {
      this.formError.set('The category name is required.');
      return;
    }
    const payload = {
      name: this.name().trim(),
      description: this.description().trim() || null,
      status: this.status(),
    };
    const id = this.editingId();
    const request = id ? this.categoryService.update(id, payload) : this.categoryService.create(payload);
    this.isSaving.set(true);
    this.formError.set('');
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.loadCategories();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        const message = error.error?.message;
        this.formError.set(typeof message === 'string' ? message : 'Could not save the category.');
      },
    });
  }

  deleteCategory(category: Category): void {
    if (!this.i18n.confirm(this.i18n.t('Delete the category {name}?', { name: category.name }))) {
      return;
    }
    this.errorMessage.set('');
    this.categoryService.remove(category.id).subscribe({
      next: () => this.loadCategories(),
      error: (error: HttpErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'Could not delete the category.'),
    });
  }

  protected deleteTitle(category: Category): string {
    if (!this.canManage()) {
      return 'Only the WMS admin can delete';
    }
    return category.productCount > 0 ? 'Has products: move them first, or set it to Inactive' : 'Delete';
  }
}
