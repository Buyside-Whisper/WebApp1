import { computed, signal } from '@angular/core';

export interface TableColumn<K extends string> {
  key: K;
  label: string;
}

const MIN_WIDTH = 60;

interface ColumnSizes<K extends string> {
  widths: Partial<Record<K, number>>;
  rest: number;
}

export class ColumnOrder<K extends string = string> {
  private readonly storageKey: string;
  private readonly sizesKey: string;
  private readonly byKey: Map<K, TableColumn<K>>;
  private readonly order = signal<K[]>([]);
  private readonly sizes = signal<ColumnSizes<K> | null>(null);
  private readonly isShown: (key: string) => boolean;

  readonly dragging = signal<K | null>(null);
  readonly dropTarget = signal<K | null>(null);
  readonly resizing = signal<K | null>(null);

  readonly columns = computed(() => this.order().filter((key) => this.isShown(key)).map((key) => this.byKey.get(key)!));
  readonly isSized = computed(() => this.sizes() !== null);
  readonly isCustom = computed(
    () => this.isSized() || this.order().join() !== this.defaults.map((c) => c.key).join(),
  );
  readonly tableWidth = computed(() => {
    const sizes = this.sizes();
    return sizes
      ? this.columns().reduce((sum, { key }) => sum + (sizes.widths[key] ?? MIN_WIDTH * 2), sizes.rest)
      : null;
  });

  constructor(
    tableId: string,
    private readonly defaults: TableColumn<K>[],
    isShown: (key: K) => boolean = () => true,
  ) {
    this.isShown = isShown as (key: string) => boolean;
    this.storageKey = `columns:${tableId}`;
    this.sizesKey = `columns:${tableId}:widths`;
    this.byKey = new Map(defaults.map((column) => [column.key, column]));
    this.order.set(this.load());
    this.sizes.set(this.loadSizes());
  }

  width(key: K): number | null {
    return this.sizes()?.widths[key] ?? null;
  }

  startResize(event: PointerEvent, key: K): void {
    event.preventDefault();
    event.stopPropagation();
    const header = (event.target as HTMLElement).closest('th');
    if (!header?.parentElement) {
      return;
    }
    if (!this.sizes()) {
      const widths: Partial<Record<K, number>> = {};
      let rest = 0;
      for (const cell of Array.from(header.parentElement.children) as HTMLElement[]) {
        const column = cell.dataset['column'] as K | undefined;
        const width = Math.round(cell.getBoundingClientRect().width);
        if (column && this.byKey.has(column)) {
          widths[column] = width;
        } else {
          rest += width;
        }
      }
      this.sizes.set({ widths, rest });
    }
    const startX = event.clientX;
    const startWidth = this.sizes()!.widths[key] ?? Math.round(header.getBoundingClientRect().width);
    this.resizing.set(key);
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(MIN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX));
      this.sizes.update((sizes) => sizes && { ...sizes, widths: { ...sizes.widths, [key]: width } });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.resizing.set(null);
      this.saveSizes();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  dragStart(event: DragEvent, key: K): void {
    if (this.resizing() !== null) {
      event.preventDefault();
      return;
    }
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
    this.sizes.set(null);
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.sizesKey);
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

  private loadSizes(): ColumnSizes<K> | null {
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(this.sizesKey) ?? 'null');
    } catch {
      return null;
    }
    if (!saved || typeof saved !== 'object') {
      return null;
    }
    const { widths, rest } = saved as { widths?: Record<string, unknown>; rest?: unknown };
    const known = Object.entries(widths ?? {}).filter(
      ([key, width]) => this.byKey.has(key as K) && typeof width === 'number' && width >= MIN_WIDTH,
    );
    return known.length ? { widths: Object.fromEntries(known) as Partial<Record<K, number>>, rest: Number(rest) || 0 } : null;
  }

  private saveSizes(): void {
    try {
      localStorage.setItem(this.sizesKey, JSON.stringify(this.sizes()));
    } catch {
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.order()));
    } catch {
    }
  }
}
