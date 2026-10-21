import { computed, effect, signal, untracked } from '@angular/core';

export const PAGE_SIZES = [10, 20, 50, 100];

export class Pagination<T> {
  readonly page = signal(1);
  readonly pageSize = signal(20);

  readonly total = computed(() => this.source().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly current = computed(() => Math.min(this.page(), this.pageCount()));
  readonly items = computed(() => {
    const start = (this.current() - 1) * this.pageSize();
    return this.source().slice(start, start + this.pageSize());
  });
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.current() - 1) * this.pageSize() + 1));
  readonly to = computed(() => Math.min(this.current() * this.pageSize(), this.total()));

  constructor(
    private readonly source: () => T[],
    resetOn: () => unknown = () => null,
  ) {
    effect(() => {
      resetOn();
      untracked(() => this.page.set(1));
    });
  }

  goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }
}
