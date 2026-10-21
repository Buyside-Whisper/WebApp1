import { Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, ScanBarcode } from 'lucide-angular';
import { ProductUnit } from '../../products/product.model';

export interface PickableProduct {
  id: string;
  name: string;
  barcode: string;
  unit: ProductUnit;
  available?: number;
}

@Component({
  selector: 'app-product-picker',
  imports: [DecimalPipe, LucideAngularModule],
  templateUrl: './product-picker.html',
  styleUrl: './product-picker.css',
})
export class ProductPicker {
  readonly products = input.required<PickableProduct[]>();
  readonly taken = input<string[]>([]);
  readonly placeholder = input('Add a product: name or barcode, or scan');
  readonly picked = output<PickableProduct>();

  protected readonly ScanIcon = ScanBarcode;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly message = signal('');

  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return [];
    }
    return this.products()
      .filter((p) => p.name.toLowerCase().includes(query) || p.barcode.includes(query))
      .slice(0, 8);
  });

  protected isTaken(product: PickableProduct): boolean {
    return this.taken().includes(product.id);
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.message.set('');
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    const query = this.query().trim();
    const exact = this.products().find((p) => p.barcode === query);
    const choice = exact ?? (this.matches().length ? this.matches()[0] : undefined);
    if (choice) {
      this.choose(choice);
    } else if (query) {
      this.message.set(`No product matches “${query}”.`);
    }
  }

  protected choose(product: PickableProduct): void {
    if (this.isTaken(product)) {
      this.message.set(`${product.name} is already on the list.`);
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
