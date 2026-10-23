import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { Check, ChevronDown, Globe, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Language } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-language-switch',
  imports: [TranslatePipe, LucideAngularModule],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'open.set(false)',
  },
  template: `
    <div class="language-switch" [class.language-switch--dark]="dark()">
      <button
        type="button"
        class="language-switch__button"
        aria-haspopup="listbox"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Language' | t"
        [title]="'Language' | t"
        (click)="open.set(!open())"
      >
        <lucide-icon [img]="GlobeIcon" [size]="14"></lucide-icon>
        <span>{{ current().label }}</span>
        <lucide-icon class="language-switch__caret" [img]="ChevronIcon" [size]="13"></lucide-icon>
      </button>
      @if (open()) {
        <ul class="language-switch__menu" role="listbox" [attr.aria-label]="'Language' | t">
          @for (option of options; track option.value) {
            <li>
              <button
                type="button"
                role="option"
                class="language-switch__option"
                [class.language-switch__option--on]="i18n.language() === option.value"
                [attr.aria-selected]="i18n.language() === option.value"
                (click)="choose(option.value)"
              >
                <span class="language-switch__code">{{ option.label }}</span>
                <span class="language-switch__name">{{ option.title }}</span>
                @if (i18n.language() === option.value) {
                  <lucide-icon [img]="CheckIcon" [size]="14"></lucide-icon>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .language-switch {
      position: relative;
      display: inline-block;
    }
    .language-switch__button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 3px 8px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }
    .language-switch__button:hover {
      border-color: var(--accent);
      color: var(--accent-strong);
    }
    .language-switch__caret {
      display: inline-flex;
      color: var(--ink-faint);
    }
    .language-switch__menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: 1000;
      min-width: 160px;
      margin: 0;
      padding: 3px;
      list-style: none;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    }
    .language-switch__option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 5px 8px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 0.94rem;
      text-align: left;
      cursor: pointer;
    }
    .language-switch__option:hover {
      background: var(--accent-soft);
    }
    .language-switch__option--on {
      color: var(--accent-strong);
      font-weight: 600;
    }
    .language-switch__code {
      width: 30px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--ink-muted);
    }
    .language-switch__name {
      flex: 1;
    }
    .language-switch--dark .language-switch__button {
      border-color: rgba(255, 255, 255, 0.25);
      background: transparent;
      color: #e2e8f0;
    }
    .language-switch--dark .language-switch__button:hover {
      border-color: #ffffff;
      color: #ffffff;
    }
    .language-switch--dark .language-switch__caret {
      color: #cbd5e1;
    }
  `,
})
export class LanguageSwitch {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly dark = input(false);

  protected readonly GlobeIcon = Globe;
  protected readonly ChevronIcon = ChevronDown;
  protected readonly CheckIcon = Check;
  protected readonly open = signal(false);

  protected readonly options: { value: Language; label: string; title: string }[] = [
    { value: 'en', label: 'ENG', title: 'English' },
    { value: 'ru', label: 'РУС', title: 'Русский' },
    { value: 'ka', label: 'ქარ', title: 'ქართული' },
  ];

  protected readonly current = computed(
    () => this.options.find((option) => option.value === this.i18n.language()) ?? this.options[0],
  );

  protected choose(language: Language): void {
    this.open.set(false);
    this.i18n.use(language);
    this.auth.saveLanguage(language);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !(this.host.nativeElement as HTMLElement).contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
