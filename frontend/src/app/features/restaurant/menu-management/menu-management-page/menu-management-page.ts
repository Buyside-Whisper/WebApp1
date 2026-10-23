import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-menu-management-page',
  imports: [TranslatePipe, ],
  templateUrl: './menu-management-page.html',
  styleUrl: './menu-management-page.css',
})
export class MenuManagementPage {

}
