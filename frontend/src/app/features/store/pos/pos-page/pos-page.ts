import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CashRegisterService } from '../../cash-register/cash-register.service';
import { RegisterSession } from '../../cash-register/cash-register.model';
import { StoreProduct } from '../pos.model';
import { PosService } from '../pos.service';

interface CartLine {
  product: StoreProduct;
  quantity: number;
}

@Component({
  selector: 'app-pos-page',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './pos-page.html',
  styleUrl: './pos-page.css',
})
export class PosPage implements OnInit {
  private readonly posService = inject(PosService);
  private readonly cashRegisterService = inject(CashRegisterService);

  protected readonly products = signal<StoreProduct[]>([]);
  protected readonly session = signal<RegisterSession | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isCharging = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly lastSale = signal<{ number: number; total: number } | null>(null);

  protected readonly cart = signal<CartLine[]>([]);
  protected readonly total = computed(() =>
    this.cart().reduce((sum, line) => sum + line.product.price * line.quantity, 0),
  );
  protected readonly itemCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));

  ngOnInit(): void {
    this.posService.products().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.errorMessage.set('Could not load the products. Is the backend running?'),
    });
    this.cashRegisterService.current().subscribe({
      next: (session) => {
        this.session.set(session);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  add(product: StoreProduct): void {
    this.lastSale.set(null);
    this.cart.update((lines) => {
      const existing = lines.find((line) => line.product.id === product.id);
      return existing
        ? lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line))
        : [...lines, { product, quantity: 1 }];
    });
  }

  change(line: CartLine, delta: number): void {
    this.cart.update((lines) =>
      lines
        .map((current) => (current === line ? { ...current, quantity: current.quantity + delta } : current))
        .filter((current) => current.quantity > 0),
    );
  }

  clear(): void {
    this.cart.set([]);
  }

  charge(): void {
    if (this.cart().length === 0 || !this.session()) {
      return;
    }

    this.isCharging.set(true);
    this.errorMessage.set('');
    this.posService
      .createSale(this.cart().map((line) => ({ productId: line.product.id, quantity: line.quantity })))
      .subscribe({
        next: (sale) => {
          this.isCharging.set(false);
          this.lastSale.set({ number: sale.number, total: sale.total });
          this.cart.set([]);
        },
        error: (error: HttpErrorResponse) => {
          this.isCharging.set(false);
          const message = error.error?.message;
          this.errorMessage.set(typeof message === 'string' ? message : 'Could not record the sale.');
        },
      });
  }
}
