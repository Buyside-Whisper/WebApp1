import { computed, signal } from '@angular/core';

export interface TableColumn<K extends string> {
  key: K;
  label: string;
}

export class ColumnOrder<K extends string> {
  private readonly storageKey: string;
  private readonly byKey: Map<K, TableColumn<K>>;
  private readonly order = signal<K[]>([]);

  readonly dragging = signal<K | null>(null);
  readonly dropTarget = signal<K | null>(null);

  readonly columns = computed(() => this.order().map((key) => this.byKey.get(key)!));
  readonly isCustom = computed(() => this.order().join() !== this.defaults.map((c) => c.key).join());

  constructor(
    tableId: string,
    private readonly defaults: TableColumn<K>[],
  ) {
    this.storageKey = `columns:${tableId}`;
    this.byKey = new Map(defaults.map((column) => [column.key, column]));
    this.order.set(this.load());
  }

  dragStart(event: DragEvent, key: K): void {
    this.dragging.set(key);
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  dragOver(event: DragEvent, key: K): void {
    if (this.dragging() === null) {
      return;
    }
    event.preventDefault();
    this.dropTarget.set(key);
  }

  drop(event: DragEvent, key: K): void {
    event.preventDefault();
    const from = this.dragging();
    if (from !== null && from !== key) {
      const keys = this.order().filter((k) => k !== from);
      const movingRight = this.order().indexOf(from) < this.order().indexOf(key);
      keys.splice(keys.indexOf(key) + (movingRight ? 1 : 0), 0, from);
      this.order.set(keys);
      this.save();
    }
    this.dragEnd();
  }

  dropSide(key: K): 'before' | 'after' | null {
    const from = this.dragging();
    if (from === null || from === key || this.dropTarget() !== key) {
      return null;
    }
    return this.order().indexOf(from) < this.order().indexOf(key) ? 'after' : 'before';
  }

  dragEnd(): void {
    this.dragging.set(null);
    this.dropTarget.set(null);
  }

  reset(): void {
    this.order.set(this.defaults.map((column) => column.key));
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
    }
  }

  private load(): K[] {
    const keys = this.defaults.map((column) => column.key);
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(this.storageKey) ?? 'null');
    } catch {
      return keys;
    }
    if (!Array.isArray(saved)) {
      return keys;
    }
    const known = saved.filter((key): key is K => this.byKey.has(key as K));
    const result = [...new Set(known)];
    keys.forEach((key, index) => {
      if (!result.includes(key)) {
        result.splice(Math.min(index, result.length), 0, key);
      }
    });
    return result;
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.order()));
    } catch {
    }
  }
}
