import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-waiter-view-page',
  imports: [TranslatePipe, ],
  templateUrl: './waiter-view-page.html',
  styleUrl: './waiter-view-page.css',
})
export class WaiterViewPage {

}
