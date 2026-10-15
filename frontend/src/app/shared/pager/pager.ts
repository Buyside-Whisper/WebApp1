import { Component, computed, input } from '@angular/core';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { PAGE_SIZES, Pagination } from './pagination';

// Page controls under a table: "21–40 of 312", rows per page, previous / page numbers / next.
//   <app-pager [pagination]="pages" />
@Component({
  selector: 'app-pager',
  imports: [LucideAngularModule],
  templateUrl: './pager.html',
  styleUrl: './pager.css',
})
export class Pager {
  readonly pagination = input.required<Pagination<unknown>>();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly PrevIcon = ChevronLeft;
  protected readonly NextIcon = ChevronRight;

  // First, last, and two pages around the current one; null marks a gap ("…").
  protected readonly pageNumbers = computed(() => {
    const current = this.pagination().current();
    const count = this.pagination().pageCount();
    const pages: (number | null)[] = [];
    for (let page = 1; page <= count; page++) {
      if (page === 1 || page === count || Math.abs(page - current) <= 2) {
        pages.push(page);
      } else if (pages[pages.length - 1] !== null) {
        pages.push(null);
      }
    }
    return pages;
  });

  protected changeSize(event: Event): void {
    this.pagination().setPageSize(Number((event.target as HTMLSelectElement).value));
  }
}
