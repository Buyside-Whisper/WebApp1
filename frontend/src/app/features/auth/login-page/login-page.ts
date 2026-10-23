import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { landingUrl } from '../../../core/auth/access';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSwitch } from '../../../shared/language-switch/language-switch';
import { TranslatePipe } from '../../../core/i18n/t.pipe';

@Component({
  selector: 'app-login-page',
  imports: [TranslatePipe, LanguageSwitch, FormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');

  constructor() {
    const user = this.auth.user();
    if (user) {
      void this.router.navigateByUrl(landingUrl(user));
    }
  }

  signIn(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.auth.login(this.username().trim(), this.password()).subscribe({
      next: (session) => {
        this.isLoading.set(false);
        void this.router.navigateByUrl(landingUrl(session.user));
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.status === 401
            ? typeof error.error?.message === 'string' && error.error.message !== 'Wrong username or password'
              ? error.error.message
              : 'Wrong username or password.'
            : 'Could not reach the server. Is the backend running?',
        );
      },
    });
  }
}
