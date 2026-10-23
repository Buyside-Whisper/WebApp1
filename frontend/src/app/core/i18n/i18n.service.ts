import { Injectable, signal } from '@angular/core';
import { KA } from './ka';
import { RU } from './ru';

export type Language = 'en' | 'ka' | 'ru';

const DICTIONARIES: Record<Language, Record<string, string> | null> = { en: null, ka: KA, ru: RU };

const asLanguage = (value: string | null | undefined): Language =>
  value === 'ka' || value === 'ru' ? value : 'en';

const STORAGE_KEY = 'webapp1.language';

export type TranslationParams = Record<string, string | number | null | undefined>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<Language>(loadLanguage());

  constructor() {
    document.documentElement.lang = this.language();
  }

  use(language: string | null | undefined): void {
    const next = asLanguage(language);
    this.language.set(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  confirm(text: string, params?: TranslationParams): boolean {
    return window.confirm(this.t(text, params));
  }

  t(text: string, params?: TranslationParams): string {
    const template = DICTIONARIES[this.language()]?.[text] ?? text;
    return params
      ? template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key] ?? '') : match))
      : template;
  }
}

function loadLanguage(): Language {
  try {
    return asLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'en';
  }
}
