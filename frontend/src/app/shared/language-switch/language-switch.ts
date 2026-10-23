import { Component, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Language } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-language-switch',
  imports: [TranslatePipe],
  template: `
    <div class="language-switch" [class.language-switch--dark]="dark()" role="group" [attr.aria-label]="'Language' | t">
      @for (option of options; track option.value) {
        <button
          type="button"
          class="language-switch__option"
          [class.language-switch__option--on]="i18n.language() === option.value"
          [attr.aria-pressed]="i18n.language() === option.value"
          [title]="option.title"
          (click)="choose(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .language-switch {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      background: #ffffff;
    }
    .language-switch__option {
      padding: 3px 10px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: #64748b;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }
    .language-switch__option--on {
      background: #eef2ff;
      color: #4338ca;
    }
    .language-switch--dark {
      border-color: rgba(255, 255, 255, 0.25);
      background: transparent;
    }
    .language-switch--dark .language-switch__option {
      color: #cbd5e1;
    }
    .language-switch--dark .language-switch__option--on {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }
  `,
})
export class LanguageSwitch {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly dark = input(false);

  protected readonly options: { value: Language; label: string; title: string }[] = [
    { value: 'en', label: 'ENG', title: 'English' },
    { value: 'ka', label: 'ქარ', title: 'ქართული' },
  ];

  protected choose(language: Language): void {
    this.i18n.use(language);
    this.auth.saveLanguage(language);
  }
}
