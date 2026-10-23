import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-record-expense-page',
  imports: [TranslatePipe, ],
  templateUrl: './record-expense-page.html',
  styleUrl: './record-expense-page.css',
})
export class RecordExpensePage {

}
