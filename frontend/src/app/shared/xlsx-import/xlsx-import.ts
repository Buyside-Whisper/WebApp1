import { Component, computed, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CircleCheck,
  CircleX,
  Download,
  FileSpreadsheet,
  LucideAngularModule,
  TriangleAlert,
} from 'lucide-angular';
import { ImportIssue, ImportReport, ImportSource, PreviewColumn, saveFile } from './xlsx-import.model';

@Component({
  selector: 'app-xlsx-import',
  imports: [LucideAngularModule],
  templateUrl: './xlsx-import.html',
  styleUrl: './xlsx-import.css',
})
export class XlsxImport<P extends { row: number }> {
  readonly source = input.required<ImportSource<P>>();
  readonly columns = input.required<PreviewColumn<P>[]>();
  readonly noun = input.required<{ one: string; many: string }>();
  readonly description = input.required<string>();
  readonly templateName = input.required<string>();
  readonly codeLabel = input('Code');

  readonly imported = output<void>();
  readonly closed = output<void>();

  protected readonly DownloadIcon = Download;
  protected readonly FileIcon = FileSpreadsheet;
  protected readonly ErrorIcon = CircleX;
  protected readonly WarningIcon = TriangleAlert;
  protected readonly DoneIcon = CircleCheck;

  protected readonly file = signal<File | null>(null);
  protected readonly report = signal<ImportReport<P> | null>(null);
  protected readonly busy = signal<'' | 'template' | 'checking' | 'importing'>('');
  protected readonly errorMessage = signal('');

  protected readonly errors = computed(() => this.sorted(this.report()?.errors ?? []));
  protected readonly warnings = computed(() => this.sorted(this.report()?.warnings ?? []));
  protected readonly badRows = computed(
    () => new Set(this.errors().flatMap((issue) => (issue.row && issue.row > 1 ? [issue.row] : []))).size,
  );
  protected readonly canImport = computed(() => {
    const report = this.report();
    return !!report && !report.imported && report.errors.length === 0 && report.validRows > 0;
  });

  downloadTemplate(): void {
    this.busy.set('template');
    this.errorMessage.set('');
    this.source()
      .template()
      .subscribe({
        next: (blob) => {
          this.busy.set('');
          saveFile(blob, this.templateName());
        },
        error: () => {
          this.busy.set('');
          this.errorMessage.set('Could not download the template. Is the backend running?');
        },
      });
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    this.file.set(file);
    this.report.set(null);
    this.errorMessage.set('');
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.errorMessage.set(
        `"${file.name}" is not an .xlsx file. In Excel use File → Save As → Excel Workbook (.xlsx).`,
      );
      return;
    }
    this.busy.set('checking');
    this.source()
      .check(file)
      .subscribe({
        next: (report) => {
          this.busy.set('');
          this.report.set(report);
        },
        error: (error: HttpErrorResponse) => this.fail(error, 'Could not check the file.'),
      });
  }

  runImport(): void {
    const file = this.file();
    if (!file || !this.canImport()) {
      return;
    }
    this.busy.set('importing');
    this.errorMessage.set('');
    this.source()
      .import(file)
      .subscribe({
        next: (report) => {
          this.busy.set('');
          this.report.set(report);
          if (report.imported) {
            this.imported.emit();
          }
        },
        error: (error: HttpErrorResponse) => this.fail(error, 'Could not import the file.'),
      });
  }

  protected count(n: number): string {
    return `${n} ${n === 1 ? this.noun().one : this.noun().many}`;
  }

  private sorted(issues: ImportIssue[]): ImportIssue[] {
    return [...issues].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.busy.set('');
    const message = error.error?.message;
    this.errorMessage.set(
      typeof message === 'string'
        ? message
        : error.status === 413
          ? 'The file is too big (max 5 MB).'
          : `${fallback} Is the backend running?`,
    );
  }
}
