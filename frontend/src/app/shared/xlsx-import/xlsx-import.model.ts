import { Observable } from 'rxjs';

export interface ImportIssue {
  row: number | null;
  column: string | null;
  value: string | null;
  message: string;
}

export interface ImportReport<P extends { row: number }> {
  fileName: string;
  totalRows: number;
  validRows: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  rows: P[];
  imported: { code: string; name: string }[] | null;
}

export interface ImportSource<P extends { row: number }> {
  template(): Observable<Blob>;
  check(file: File): Observable<ImportReport<P>>;
  import(file: File): Observable<ImportReport<P>>;
}

export interface PreviewColumn<P> {
  label: string;
  value: (row: P) => string | number;
  strong?: boolean;
  figure?: boolean;
}

export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const today = () => new Date().toISOString().slice(0, 10);
