import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { ColumnOrder } from './column-order';

@Component({
  selector: 'app-column-tools',
  imports: [TranslatePipe],
  template: `
    @if (hint() || columns().isCustom()) {
      <div class="table-toolbar__hint" [class.column-tools--alone]="alone()">
        @if (hint()) {
          <span>{{ 'Drag a column header to move it, or its right edge to resize it.' | t }}</span>
        }
        @if (columns().isCustom()) {
          <button type="button" class="link-button" (click)="columns().reset()">{{ 'Reset columns' | t }}</button>
        }
      </div>
    }
  `,
})
export class ColumnTools {
  readonly columns = input.required<ColumnOrder<string>>({ alias: 'columnOrder' });
  readonly hint = input(true);
  readonly alone = input(false);
}
