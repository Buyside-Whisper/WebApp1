import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { Store } from '../../stores/store.model';
import { StoreService } from '../../stores/store.service';
import { RegisterAvailability, RegisterSession, RegisterSessionDetail } from '../cash-register.model';
import { CashRegisterService } from '../cash-register.service';

@Component({
  selector: 'app-cash-register-page',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cash-register-page.html',
  styleUrl: './cash-register-page.css',
})
export class CashRegisterPage implements OnInit {
  private readonly cashRegisterService = inject(CashRegisterService);
  private readonly storeService = inject(StoreService);
  private readonly auth = inject(AuthService);

  protected readonly canOperate = computed(() => {
    const role = this.auth.user()?.role;
    return role === 'manager' || role === 'cashier';
  });
  protected readonly sees = computed(() => {
    switch (this.auth.user()?.role) {
      case 'cashier':
        return 'The registers you have worked on.';
      case 'manager':
        return 'Every register opened in your stores.';
      default:
        return 'Every register opened in the company.';
    }
  });

  protected readonly sessions = signal<RegisterSession[]>([]);
  protected readonly current = signal<RegisterSession | null>(null);
  protected readonly stores = signal<Store[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isBusy = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly storeId = signal('');
  protected readonly registerNo = signal(0);
  protected readonly availability = signal<RegisterAvailability[]>([]);
  protected readonly openingCash = signal(100);
  protected readonly closingCash = signal(0);

  protected readonly expandedId = signal<string | null>(null);
  protected readonly details = signal<Record<string, RegisterSessionDetail>>({});

  ngOnInit(): void {
    this.load();
    if (this.canOperate()) {
      this.storeService.list().subscribe((stores) => {
        this.stores.set(stores);
        if (stores.length === 1) {
          this.chooseStore(stores[0].id);
        }
      });
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.cashRegisterService.list().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load registers. Is the backend running?');
        this.isLoading.set(false);
      },
    });
    if (this.canOperate()) {
      this.cashRegisterService.current().subscribe((session) => this.current.set(session));
    }
  }

  chooseStore(storeId: string): void {
    this.storeId.set(storeId);
    this.registerNo.set(0);
    this.availability.set([]);
    if (!storeId) {
      return;
    }
    this.cashRegisterService.registers(storeId).subscribe((registers) => {
      this.availability.set(registers);
      const free = registers.filter((register) => !register.inUseBy);
      if (free.length === 1) {
        this.registerNo.set(free[0].no);
      }
    });
  }

  open(): void {
    if (!this.storeId() || !this.registerNo()) {
      this.errorMessage.set('Choose a store and a register.');
      return;
    }
    this.run(
      this.cashRegisterService.open(this.storeId(), this.registerNo(), Number(this.openingCash()) || 0),
      () => this.closingCash.set(0),
      () => this.chooseStore(this.storeId()),
    );
  }

  close(session: RegisterSession): void {
    this.run(this.cashRegisterService.close(session.id, Number(this.closingCash()) || 0), () => {
      this.details.update((all) => {
        const { [session.id]: _removed, ...rest } = all;
        return rest;
      });
    });
  }

  toggle(session: RegisterSession): void {
    if (this.expandedId() === session.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(session.id);
    if (!this.details()[session.id]) {
      this.cashRegisterService.detail(session.id).subscribe((detail) =>
        this.details.update((all) => ({ ...all, [session.id]: detail })),
      );
    }
  }

  protected itemsOf(sale: RegisterSessionDetail['sales'][number]): string {
    return sale.lines.map((line) => `${line.quantity} × ${line.productName}`).join(', ');
  }

  private run(request: ReturnType<CashRegisterService['open']>, after: () => void, onError?: () => void): void {
    this.isBusy.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.isBusy.set(false);
        after();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.isBusy.set(false);
        const message = error.error?.message;
        this.errorMessage.set(typeof message === 'string' ? message : 'That did not work.');
        onError?.();
      },
    });
  }
}
