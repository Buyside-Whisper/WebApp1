import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { TranslatePipe } from '../../core/i18n/t.pipe';

let nextId = 0;

@Component({
  selector: 'app-modal',
  imports: [TranslatePipe, LucideAngularModule],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();

  protected readonly XIcon = X;
  protected readonly titleId = `modal-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.closed.emit();
    }
  }
}
