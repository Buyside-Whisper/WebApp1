import { Component, DestroyRef, ElementRef, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { ChevronDown, LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { wordMatch } from '../word-search';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string | null;
}

@Component({
  selector: 'app-combobox',
  imports: [TranslatePipe, LucideAngularModule],
  templateUrl: './combobox.html',
  styleUrl: './combobox.css',
})
export class Combobox {
  readonly options = input.required<ComboOption[]>();
  readonly value = model('');
  readonly placeholder = input('Choose…');
  readonly inputId = input<string | null>(null);
  readonly invalid = input(false);

  protected readonly ChevronIcon = ChevronDown;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly position = signal({ top: 0, left: 0, width: 0, maxHeight: 0 });
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  protected readonly selected = computed(() => this.options().find((option) => option.value === this.value()) ?? null);
  protected readonly matches = computed(() =>
    this.options()
      .flatMap((option) => {
        const rank = wordMatch(`${option.label} ${option.hint ?? ''}`, this.query());
        return rank === null ? [] : [{ option, rank }];
      })
      .sort((a, b) => a.rank - b.rank)
      .map(({ option }) => option),
  );

  constructor() {
    const follow = () => {
      if (this.open()) {
        this.place();
      }
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    });
  }

  protected show(): void {
    this.query.set('');
    const index = this.matches().findIndex((option) => option.value === this.value());
    this.active.set(Math.max(0, index));
    this.place();
    this.open.set(true);
    setTimeout(() => this.scrollToActive());
  }

  protected onInput(text: string): void {
    this.query.set(text);
    this.active.set(0);
    if (!this.open()) {
      this.place();
      this.open.set(true);
    }
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) {
        this.show();
        return;
      }
      const count = this.matches().length;
      if (count) {
        this.active.set((this.active() + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
        this.scrollToActive();
      }
    } else if (event.key === 'Enter') {
      if (this.open()) {
        event.preventDefault();
        const option = this.matches()[this.active()];
        if (option) {
          this.choose(option);
        }
      }
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
    }
  }

  protected choose(option: ComboOption): void {
    this.value.set(option.value);
    this.close();
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.field().nativeElement.focus();
    }
  }

  protected onBlur(): void {
    setTimeout(() => this.close(), 150);
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
  }

  private place(): void {
    const box = this.field().nativeElement.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 16;
    const above = box.top - 16;
    const maxHeight = Math.max(160, Math.min(360, below >= 240 ? below : Math.max(below, above)));
    const top = below >= 240 || below >= above ? box.bottom + 6 : Math.max(8, box.top - 6 - maxHeight);
    this.position.set({ top, left: box.left, width: box.width, maxHeight });
  }

  private scrollToActive(): void {
    this.list()?.nativeElement.querySelector<HTMLElement>('.combobox__option--active')?.scrollIntoView({ block: 'nearest' });
  }
}
