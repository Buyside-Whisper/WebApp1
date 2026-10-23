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
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      overflow: hidden;
    }
    .language-switch__option {
      padding: 3px 9px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--ink-muted);
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
    }
    .language-switch__option + .language-switch__option {
      border-left: 1px solid var(--line-strong);
    }
    .language-switch__option--on {
      background: var(--accent);
      color: #ffffff;
    }
    .language-switch--dark {
      border-color: rgba(255, 255, 255, 0.25);
      background: transparent;
    }
    .language-switch--dark .language-switch__option {
      color: #cbd5e1;
    }
    .language-switch--dark .language-switch__option + .language-switch__option {
      border-left-color: rgba(255, 255, 255, 0.25);
    }
    .language-switch--dark .language-switch__option--on {
      background: var(--accent);
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
