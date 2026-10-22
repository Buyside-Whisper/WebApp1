import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FileText, LucideAngularModule, PlugZap } from 'lucide-angular';

@Component({
  selector: 'app-rs-tabs',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <nav class="page-tabs" aria-label="RS">
      @for (tab of tabs; track tab.link) {
        <a
          class="page-tabs__link"
          [routerLink]="tab.link"
          routerLinkActive="page-tabs__link--active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          <lucide-icon [img]="tab.icon" [size]="16"></lucide-icon>
          {{ tab.label }}
        </a>
      }
    </nav>
  `,
})
export class RsTabs {
  protected readonly tabs = [
    { link: '/rs/waybills', label: 'Received waybills', icon: FileText },
    { link: '/rs/waybills/connection', label: 'RS connection', icon: PlugZap },
  ];
}
