import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ColumnOrder } from './column-order';

@Directive({
  selector: 'table[appColumns]',
  host: {
    '[class.data-table--sized]': 'columns().isSized()',
    '[style.width.px]': 'columns().tableWidth()',
  },
})
export class ColumnTable {
  readonly columns = input.required<ColumnOrder<string>>({ alias: 'appColumns' });
}

@Directive({
  selector: 'th[appColumn]',
  host: {
    class: 'th-draggable',
    draggable: 'true',
    '[class.th-dragging]': 'columns().dragging() === key()',
    '[class.th-drop-before]': "columns().dropSide(key()) === 'before'",
    '[class.th-drop-after]': "columns().dropSide(key()) === 'after'",
    '[attr.data-column]': 'key()',
    '[style.width.px]': 'columns().width(key())',
    '(dragstart)': 'columns().dragStart($event, key())',
    '(dragover)': 'columns().dragOver($event, key())',
    '(drop)': 'columns().drop($event, key())',
    '(dragend)': 'columns().dragEnd()',
  },
})
export class ColumnHeader {
  readonly key = input.required<string>({ alias: 'appColumn' });
  readonly columns = input.required<ColumnOrder<string>>({ alias: 'columnOrder' });

  constructor() {
    const renderer = inject(Renderer2);
    const i18n = inject(I18nService);
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const handle = renderer.createElement('span') as HTMLElement;
    renderer.addClass(handle, 'th-resize');
    renderer.listen(handle, 'pointerdown', (event: PointerEvent) => this.columns().startResize(event, this.key()));
    renderer.listen(handle, 'click', (event: Event) => event.stopPropagation());
    renderer.appendChild(host, handle);
    effect(() => {
      handle.title = i18n.t('Drag to resize');
      handle.classList.toggle('th-resize--active', this.columns().resizing() === this.key());
    });
  }
}
