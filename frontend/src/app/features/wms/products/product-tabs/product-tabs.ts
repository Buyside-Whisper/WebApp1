import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Boxes, Layers, LucideAngularModule, Truck } from 'lucide-angular';

@Component({
  selector: 'app-product-tabs',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <nav class="page-tabs" aria-label="Products">
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
export class ProductTabs {
  protected readonly tabs = [
    { link: '/wms/products', label: 'Products', icon: Boxes },
    { link: '/wms/products/categories', label: 'Categories', icon: Layers },
    { link: '/wms/products/suppliers', label: 'Suppliers', icon: Truck },
  ];
}
