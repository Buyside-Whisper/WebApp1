import { Component, DestroyRef, ElementRef, computed, input, output, signal, inject, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, ScanBarcode } from 'lucide-angular';
import { ProductUnit } from '../../products/product.model';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

const WORD_SPLIT = /[\s,.;:()\[\]\/\\+&-]+/;

export interface PickableProduct {
  id: string;
  name: string;
  barcode: string;
  unit: ProductUnit;
  available?: number;
}

@Component({
  selector: 'app-product-picker',
  imports: [TranslatePipe, DecimalPipe, LucideAngularModule],
  templateUrl: './product-picker.html',
  styleUrl: './product-picker.css',
})
export class ProductPicker {
  private readonly i18n = inject(I18nService);
  readonly products = input.required<PickableProduct[]>();
  readonly taken = input<string[]>([]);
  readonly placeholder = input('Add a product: name or barcode, or scan');
  readonly picked = output<PickableProduct>();

  protected readonly ScanIcon = ScanBarcode;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly message = signal('');
  protected readonly position = signal({ top: 0, left: 0, width: 0, maxHeight: 0 });
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    const follow = () => {
      if (this.open()) {
        this.show();
      }
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    });
  }

  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return [];
    }
    const queryWords = query.split(WORD_SPLIT).filter(Boolean);
    return this.products()
      .flatMap((p) => {
        const name = p.name.toLowerCase();
        const words = name.split(WORD_SPLIT);
        const byName = queryWords.length > 0 && queryWords.every((q) => words.some((word) => word.startsWith(q)));
        if (!byName && !p.barcode.toLowerCase().includes(query)) {
          return [];
        }
        return [{ product: p, rank: name.startsWith(query) ? 0 : byName ? 1 : 2 }];
      })
      .sort((a, b) => a.rank - b.rank || a.product.name.localeCompare(b.product.name))
      .slice(0, 50)
      .map(({ product }) => product);
  });

  protected isTaken(product: PickableProduct): boolean {
    return this.taken().includes(product.id);
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.show();
    this.message.set('');
  }

  protected show(): void {
    const box = this.field().nativeElement.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 16;
    const above = box.top - 16;
    const maxHeight = Math.max(160, Math.min(420, below >= 240 ? below : Math.max(below, above)));
    const top = below >= 240 || below >= above ? box.bottom + 6 : Math.max(8, box.top - 6 - maxHeight);
    this.position.set({ top, left: box.left, width: Math.max(box.width, 360), maxHeight });
    this.open.set(true);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    const query = this.query().trim();
    const exact = this.products().find((p) => p.barcode === query);
    const choice = exact ?? (this.matches().length ? this.matches()[0] : undefined);
    if (choice) {
      this.choose(choice);
    } else if (query) {
      this.message.set(this.i18n.t('No product matches “{query}”.', { query }));
    }
  }

  protected choose(product: PickableProduct): void {
    if (this.isTaken(product)) {
      this.message.set(this.i18n.t('{name} is already on the list.', { name: product.name }));
    } else {
      this.picked.emit(product);
      this.message.set('');
    }
    this.query.set('');
    this.open.set(false);
  }

  protected onBlur(): void {
    setTimeout(() => this.open.set(false), 150);
  }
}
