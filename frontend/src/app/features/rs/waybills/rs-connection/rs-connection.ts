import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { RsTabs } from '../rs-tabs/rs-tabs';
import { RsConnection as RsConnectionModel } from '../rs.model';
import { RsService } from '../rs.service';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-rs-connection',
  imports: [TranslatePipe, DatePipe, FormsModule, LucideAngularModule, RsTabs],
  templateUrl: './rs-connection.html',
  styleUrl: './rs-connection.css',
})
export class RsConnection implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly rsService = inject(RsService);
  private readonly auth = inject(AuthService);

  protected readonly canEdit = computed(() => this.auth.user()?.role === 'system_admin');
  protected readonly ShowIcon = Eye;
  protected readonly HideIcon = EyeOff;

  protected readonly connection = signal<RsConnectionModel | null>(null);
  protected readonly isEditing = signal(false);
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly busy = signal<'' | 'save' | 'check' | 'remove'>('');
  protected readonly message = signal('');
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.rsService.connection().subscribe({
      next: (connection) => {
        this.connection.set(connection);
        this.isEditing.set(!connection.connected && this.canEdit());
      },
      error: () => this.errorMessage.set('Could not reach the backend. Is it running?'),
    });
  }

  startEditing(): void {
    this.username.set(this.connection()?.username ?? '');
    this.password.set('');
    this.showPassword.set(false);
    this.message.set('');
    this.errorMessage.set('');
    this.isEditing.set(true);
  }

  save(): void {
    if (!this.username().trim() || !this.password()) {
      this.errorMessage.set('Enter the service user and its password.');
      return;
    }
    this.busy.set('save');
    this.errorMessage.set('');
    this.message.set('');
    this.rsService.saveConnection(this.username().trim(), this.password()).subscribe({
      next: (connection) => {
        this.busy.set('');
        this.connection.set(connection);
        this.password.set('');
        this.isEditing.set(false);
        this.message.set('RS accepted the service user. The connection is saved.');
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not save the RS connection.'),
    });
  }

  check(): void {
    this.busy.set('check');
    this.errorMessage.set('');
    this.message.set('');
    this.rsService.checkConnection().subscribe({
      next: (connection) => {
        this.busy.set('');
        this.connection.set(connection);
        if (connection.checkOk) {
          this.message.set('RS accepts the saved service user.');
        } else {
          this.errorMessage.set('RS no longer accepts the saved service user. Enter it again.');
        }
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not check the RS connection.'),
    });
  }

  remove(): void {
    if (!this.i18n.confirm('Remove the RS connection? The RS waybills page stops working until it is added again.')) {
      return;
    }
    this.busy.set('remove');
    this.rsService.disconnect().subscribe({
      next: () => {
        this.busy.set('');
        this.connection.set({ ...this.connection()!, connected: false, username: null, rsUnId: null, checkOk: false });
        this.message.set('The RS connection was removed.');
        this.isEditing.set(true);
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not remove the RS connection.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.busy.set('');
    const message = error.error?.message;
    this.errorMessage.set(Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback);
  }
}
