import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_UPLOAD = { limits: { fileSize: 5 * 1024 * 1024, files: 1 } };
export const MAX_IMPORT_ROWS = 1000;

export interface SheetColumn<F extends string = string> {
  field: F;
  header: string;
  aliases?: string[];
  width: number;
  required?: boolean;
  text?: boolean;
  numFmt?: string;
  choices?: string[];
}

export interface ImportIssue {
  row: number | null;
  column: string | null;
  value: string | null;
  message: string;
}

export interface ImportReport<P> {
  fileName: string;
  totalRows: number;
  validRows: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  rows: P[];
  imported: { code: string; name: string }[] | null;
}

export interface SheetRow<F extends string> {
  row: number;
  values: Partial<Record<F, string>>;
  numbers: Partial<Record<F, number>>;
}

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');

export const choiceKey = (text: string) => tidy(text).toLowerCase();

const headerKey = (text: string) => choiceKey(text.replace(/\*/g, ''));

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return tidy(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if ('richText' in value) {
    return tidy(value.richText.map((part) => part.text).join(''));
  }
  if ('formula' in value || 'sharedFormula' in value) {
    return cellText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
  }
  if ('text' in value) {
    return tidy(String(value.text));
  }
  return '';
}

function cellNumber(value: ExcelJS.CellValue): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    return typeof result === 'number' ? result : undefined;
  }
  return undefined;
}

export const headerOf = <F extends string>(columns: SheetColumn<F>[], field: F) =>
  columns.find((column) => column.field === field)!.header;

export function emptyReport<P>(fileName: string): ImportReport<P> {
  return { fileName, totalRows: 0, validRows: 0, errors: [], warnings: [], rows: [], imported: null };
}

export async function readImportFile<F extends string, P>(
  file: Express.Multer.File | undefined,
  sheetName: string,
  columns: SheetColumn<F>[],
  exportOnlyHeaders: string[] = [],
): Promise<{ report: ImportReport<P>; rows: SheetRow<F>[] }> {
  if (!file) {
    throw new BadRequestException('Choose an .xlsx file to import');
  }
  const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  if (!/\.xlsx$/i.test(fileName)) {
    throw new BadRequestException(
      `"${fileName}" is not an .xlsx file. In Excel use File → Save As → Excel Workbook (.xlsx).`,
    );
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException(
      `"${fileName}" could not be read as an Excel workbook. Save it again as .xlsx and retry.`,
    );
  }

  const report = emptyReport<P>(fileName);
  const fileError = (message: string) => {
    report.errors.push({ row: null, column: null, value: null, message });
    return { report, rows: [] };
  };
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!sheet) {
    return fileError('The workbook has no sheets');
  }

  const columnOf = new Map<F, number>();
  const ignored = new Set(exportOnlyHeaders.map(headerKey));
  sheet.getRow(1).eachCell((cell, column) => {
    const text = cellText(cell.value);
    if (!text) {
      return;
    }
    const key = headerKey(text);
    const match = columns.find(
      ({ header, aliases }) => headerKey(header) === key || (aliases ?? []).includes(key),
    );
    if (!match) {
      if (!ignored.has(key)) {
        report.warnings.push({ row: 1, column: text, value: null, message: 'Unknown column, ignored' });
      }
    } else if (columnOf.has(match.field)) {
      report.errors.push({ row: 1, column: text, value: null, message: `The "${match.header}" column appears twice` });
    } else {
      columnOf.set(match.field, column);
    }
  });
  for (const { field, header, required } of columns) {
    if (required && !columnOf.has(field)) {
      report.errors.push({
        row: 1,
        column: header,
        value: null,
        message: `The header row has no "${header}" column. Use the template's first row as the header.`,
      });
    }
  }
  if (report.errors.length) {
    return { report, rows: [] };
  }

  const rows: SheetRow<F>[] = [];
  sheet.eachRow((excelRow, row) => {
    if (row === 1) {
      return;
    }
    const values: Partial<Record<F, string>> = {};
    const numbers: Partial<Record<F, number>> = {};
    for (const [field, column] of columnOf) {
      const value = excelRow.getCell(column).value;
      values[field] = cellText(value);
      const number = cellNumber(value);
      if (number !== undefined) {
        numbers[field] = number;
      }
    }
    if (Object.values(values).some((value) => value)) {
      rows.push({ row, values, numbers });
    }
  });
  report.totalRows = rows.length;
  if (rows.length === 0) {
    return fileError(`The sheet "${sheet.name}" has no rows under the header`);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return fileError(`The file has ${rows.length} rows; at most ${MAX_IMPORT_ROWS} can be imported at once`);
  }
  return { report, rows };
}

export function rowIssues<F extends string>(
  report: ImportReport<unknown>,
  columns: SheetColumn<F>[],
  { row, values }: SheetRow<F>,
) {
  const issue = (field: F, message: string): ImportIssue => ({
    row,
    column: headerOf(columns, field),
    value: values[field] || null,
    message,
  });
  return {
    error: (field: F, message: string) => report.errors.push(issue(field, message)),
    warning: (field: F, message: string) => report.warnings.push(issue(field, message)),
  };
}

export function addTemplateSheet<F extends string>(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: SheetColumn<F>[],
): ExcelJS.Worksheet {
  const sheet = addTableSheet(
    workbook,
    name,
    columns.map((column) => ({ ...column, header: column.required ? `${column.header} *` : column.header })),
    [],
  );
  columns.forEach(({ choices }, index) => {
    if (!choices) {
      return;
    }
    for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
      sheet.getCell(row, index + 1).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${choices.join(',')}"`],
        showErrorMessage: true,
        error: `Choose one of: ${choices.join(', ')}`,
      };
    }
  });
  return sheet;
}

export function addListDropdown(
  sheet: ExcelJS.Worksheet,
  column: number,
  listSheet: string,
  count: number,
  error: string,
): void {
  if (count === 0) {
    return;
  }
  for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'${listSheet}'!$A$2:$A$${count + 1}`],
      showErrorMessage: true,
      error,
    };
  }
}

export function addTableSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Pick<SheetColumn, 'header' | 'width' | 'text' | 'numFmt'>[],
  rows: unknown[][],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map(({ header, width, text, numFmt }) => ({
    header,
    width,
    style: text ? { numFmt: '@' } : numFmt ? { numFmt } : {},
  }));
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  });
  sheet.addRows(rows);
  return sheet;
}

export function addInstructionsSheet(
  workbook: ExcelJS.Workbook,
  columns: [string, string, string, string][],
  notes: string[],
): void {
  const sheet = workbook.addWorksheet('Instructions');
  sheet.columns = [
    { header: 'Column', width: 22 },
    { header: 'Required', width: 22 },
    { header: 'What to enter', width: 70 },
    { header: 'Example', width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(columns);
  sheet.addRow([]);
  sheet.addRows(notes.map((note) => [note]));
}

export async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
