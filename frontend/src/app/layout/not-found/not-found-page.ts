import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-not-found-page',
  imports: [TranslatePipe, RouterLink],
  template: `
    <div class="page-stack">
      <div class="page-header">
        <div>
          <p class="page-eyebrow">404</p>
          <h1 class="page-title">{{ 'Page not found' | t }}</h1>
          <p class="page-description">{{ 'No page at' | t }} <code>{{ url }}</code></p>
        </div>
      </div>
      <div class="button-row">
        <a class="button button--primary" routerLink="/">{{ 'Go home' | t }}</a>
      </div>
    </div>
  `,
})
export class NotFoundPage {
  protected readonly url = inject(Router).url;
}
