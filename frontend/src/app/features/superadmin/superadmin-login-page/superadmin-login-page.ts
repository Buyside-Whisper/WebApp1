import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSwitch } from '../../../shared/language-switch/language-switch';
import { TranslatePipe } from '../../../core/i18n/t.pipe';

@Component({
  selector: 'app-superadmin-login-page',
  imports: [TranslatePipe, LanguageSwitch, FormsModule, RouterLink],
  templateUrl: './superadmin-login-page.html',
  styleUrl: './superadmin-login-page.css',
})
export class SuperadminLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  constructor() {
    if (this.auth.user()?.role === 'superuser') {
      void this.router.navigateByUrl('/superadmin');
    }
  }

  signIn(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.auth.superadminLogin(this.username().trim(), this.password()).subscribe({
      next: () => {
        this.isLoading.set(false);
        void this.router.navigateByUrl('/superadmin');
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.status === 401
            ? 'Wrong username or password.'
            : 'Could not reach the server. Is the backend running?',
        );
      },
    });
  }
}
