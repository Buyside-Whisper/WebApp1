import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, TranslationParams } from './i18n.service';

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(text: string | number | null | undefined, params?: TranslationParams): string {
    return text === null || text === undefined || text === '' ? '' : this.i18n.t(String(text), params);
  }
}
