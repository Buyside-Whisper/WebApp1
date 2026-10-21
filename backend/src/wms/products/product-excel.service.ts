import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { AuthUser } from '../../auth/auth-user.js';
import { nameKey } from '../../common/name-key.js';
import {
  ImportReport,
  SheetColumn,
  SheetRow,
  addInstructionsSheet,
  addTableSheet,
  addListDropdown,
  addTemplateSheet,
  choiceKey,
  readImportFile,
  rowIssues,
  workbookBuffer,
} from '../../common/xlsx.js';
import { Category } from '../categories/category.entity.js';
import { CategoryStatus } from '../categories/category-status.enum.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { SupplierStatus } from '../suppliers/supplier-status.enum.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { Product } from './product.entity.js';
import { ProductPosStatus } from './product-pos-status.enum.js';
import { ProductStatus } from './product-status.enum.js';
import { ProductUnit } from './product-unit.enum.js';
import { ProductUsage } from './product-usage.enum.js';
import { ProductsService } from './products.service.js';

type Field =
  | 'name'
  | 'barcode'
  | 'category'
  | 'group'
  | 'supplier'
  | 'unit'
  | 'usage'
  | 'posStatus'
  | 'status'
  | 'costPrice'
  | 'salePrice';

const SHEET_NAME = 'Products';
const MAX_PRICE = 9_999_999_999.99;

const UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.PCS]: 'pcs',
  [ProductUnit.KG]: 'kg',
};

const USAGE_LABELS: Record<ProductUsage, string> = {
  [ProductUsage.SALE]: 'For sale',
  [ProductUsage.INGREDIENT]: 'Ingredient',
  [ProductUsage.BOTH]: 'Both',
};

const POS_LABELS: Record<ProductPosStatus, string> = {
  [ProductPosStatus.STORAGE]: 'Storage only',
  [ProductPosStatus.POS]: 'Available at POS',
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  [ProductStatus.ACTIVE]: 'Active',
  [ProductStatus.INACTIVE]: 'Not active',
};

const COLUMNS: SheetColumn<Field>[] = [
  { field: 'name', header: 'Name', aliases: ['product', 'product name', 'სახელი', 'დასახელება', 'პროდუქტი'], width: 30, required: true },
  { field: 'barcode', header: 'Barcode', aliases: ['შტრიხკოდი'], width: 18, required: true, text: true },
  { field: 'category', header: 'Category', aliases: ['კატეგორია'], width: 18, required: true },
  { field: 'group', header: 'Group', aliases: ['ჯგუფი'], width: 18, required: true },
  { field: 'supplier', header: 'Supplier', aliases: ['მომწოდებელი'], width: 22, required: true },
  { field: 'unit', header: 'Unit', aliases: ['ერთეული'], width: 8, required: true, choices: Object.values(UNIT_LABELS) },
  { field: 'usage', header: 'Use', aliases: ['usage', 'გამოყენება'], width: 12, required: true, choices: Object.values(USAGE_LABELS) },
  { field: 'posStatus', header: 'POS status', aliases: ['pos', 'pos სტატუსი'], width: 18, choices: Object.values(POS_LABELS) },
  {
    field: 'status',
    header: 'Production status',
    aliases: ['status', 'სტატუსი', 'წარმოების სტატუსი'],
    width: 18,
    choices: Object.values(STATUS_LABELS),
  },
  { field: 'costPrice', header: 'Cost price', aliases: ['cost', 'თვითღირებულება'], width: 12, required: true, numFmt: '0.00' },
  { field: 'salePrice', header: 'Sale price', aliases: ['price', 'გასაყიდი ფასი', 'ფასი'], width: 12, required: true, numFmt: '0.00' },
];

const EXPORT_ONLY = ['In stock', 'Warehouses', 'Value at cost'];

const choices = <T>(labels: Record<string, string>, extra: Record<string, T>): Record<string, T> => ({
  ...Object.fromEntries(Object.entries(labels).flatMap(([value, label]) => [
    [choiceKey(value), value as T],
    [choiceKey(label), value as T],
  ])),
  ...extra,
});

const UNITS = choices<ProductUnit>(UNIT_LABELS, {
  pc: ProductUnit.PCS,
  piece: ProductUnit.PCS,
  pieces: ProductUnit.PCS,
  'ცალი': ProductUnit.PCS,
  'ც': ProductUnit.PCS,
  kilogram: ProductUnit.KG,
  'კგ': ProductUnit.KG,
  'კილოგრამი': ProductUnit.KG,
});

const USAGES = choices<ProductUsage>(USAGE_LABELS, {
  'გასაყიდი': ProductUsage.SALE,
  'გაყიდვა': ProductUsage.SALE,
  'ინგრედიენტი': ProductUsage.INGREDIENT,
  'ორივე': ProductUsage.BOTH,
});

const POS_STATUSES = choices<ProductPosStatus>(POS_LABELS, {
  storage: ProductPosStatus.STORAGE,
  'საწყობი': ProductPosStatus.STORAGE,
  'available at pos': ProductPosStatus.POS,
});

const STATUSES = choices<ProductStatus>(STATUS_LABELS, {
  inactive: ProductStatus.INACTIVE,
  'აქტიური': ProductStatus.ACTIVE,
  'არააქტიური': ProductStatus.INACTIVE,
});

export interface ProductPreviewRow {
  row: number;
  name: string;
  barcode: string;
  category: string;
  group: string;
  supplier: string;
  unit: ProductUnit;
  usage: ProductUsage;
  posStatus: ProductPosStatus;
  status: ProductStatus;
  costPrice: number;
  salePrice: number;
}

export type ProductImportReport = ImportReport<ProductPreviewRow>;

function priceOf({ values, numbers }: SheetRow<Field>, field: 'costPrice' | 'salePrice'): number | null {
  const number = numbers[field] ?? Number((values[field] ?? '').replace(/[₾\s]/g, '').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) {
    return null;
  }
  const cents = number * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6 ? Math.round(cents) / 100 : null;
}

@Injectable()
export class ProductExcelService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    private readonly productsService: ProductsService,
  ) {}

  async export(actor: AuthUser): Promise<Buffer> {
    const products = await this.productsService.findAll(actor);
    const workbook = new ExcelJS.Workbook();
    addTableSheet(
      workbook,
      SHEET_NAME,
      [
        ...COLUMNS.map(({ header, width, text, numFmt }) => ({ header, width, text, numFmt })),
        { header: 'In stock', width: 12, numFmt: '#,##0.###' },
        { header: 'Warehouses', width: 12 },
        { header: 'Value at cost', width: 14, numFmt: '#,##0.00' },
      ],
      products.map((p) => [
        p.name,
        p.barcode,
        p.category?.name ?? '',
        p.group,
        p.supplier?.name ?? '',
        UNIT_LABELS[p.unit],
        USAGE_LABELS[p.usage],
        POS_LABELS[p.posStatus],
        STATUS_LABELS[p.status],
        p.costPrice,
        p.salePrice,
        p.quantity,
        p.stocks.filter((stock) => stock.quantity !== 0).length,
        Math.round(p.quantity * p.costPrice * 100) / 100,
      ]),
    );
    return workbookBuffer(workbook);
  }

  async template(actor: AuthUser): Promise<Buffer> {
    const { categories, suppliers } = await this.activeLists(actor);
    const workbook = new ExcelJS.Workbook();
    const sheet = addTemplateSheet(workbook, SHEET_NAME, COLUMNS);
    const columnOf = (field: Field) => COLUMNS.findIndex((column) => column.field === field) + 1;
    addListDropdown(sheet, columnOf('category'), 'Categories', categories.length, 'Choose a category from the list (see the Categories sheet)');
    addListDropdown(sheet, columnOf('supplier'), 'Suppliers', suppliers.length, 'Choose a supplier from the list (see the Suppliers sheet)');
    addInstructionsSheet(
      workbook,
      [
        ['Name', 'Yes', 'Must not repeat an existing product or another row (capitals and extra spaces are ignored).', 'Milk chocolate 100 g'],
        ['Barcode', 'Yes', 'Must not repeat an existing product or another row. Keep the column as Text so leading zeros stay.', '4860001234567'],
        ['Category', 'Yes', 'An active category, as on the Categories sheet (pick it from the dropdown).', 'Sweets'],
        ['Group', 'Yes', 'Narrower group inside the category, free text.', 'Chocolate'],
        ['Supplier', 'Yes', 'An active supplier, as on the Suppliers sheet (pick it from the dropdown).', 'Barambo'],
        ['Unit', 'Yes', 'pcs or kg.', 'pcs'],
        ['Use', 'Yes', 'For sale, Ingredient or Both.', 'For sale'],
        ['POS status', 'No', 'Storage only or Available at POS. Empty means Storage only.', 'Available at POS'],
        ['Production status', 'No', 'Active or Not active. Empty means Active.', 'Active'],
        ['Cost price', 'Yes', 'Price per unit in ₾, at most 2 decimals. Receipts update it later.', '2.35'],
        ['Sale price', 'Yes', 'Price per unit in ₾, at most 2 decimals.', '3.90'],
      ],
      [
        'This adds products to the catalogue only: quantities come in through a receipt.',
        `The sheet named "${SHEET_NAME}" is read (or the first sheet). Empty rows are skipped.`,
        'An exported products file can be imported too: its extra columns (In stock, ...) are ignored.',
        'At most 1000 products per file. If any row has an error, nothing is imported.',
        'New categories and suppliers are added in Products → Categories / Suppliers first.',
      ],
    );
    addTableSheet(
      workbook,
      'Categories',
      [{ header: 'Category', width: 30 }],
      categories.length ? categories.map((c) => [c.name]) : [['No active categories yet. Add them in Products → Categories first.']],
    );
    addTableSheet(
      workbook,
      'Suppliers',
      [{ header: 'Supplier', width: 34 }],
      suppliers.length ? suppliers.map((s) => [s.name]) : [['No active suppliers yet. Add them in Products → Suppliers first.']],
    );
    return workbookBuffer(workbook);
  }

  async check(actor: AuthUser, file: Express.Multer.File | undefined): Promise<ProductImportReport> {
    return (await this.validate(actor, file)).report;
  }

  async import(actor: AuthUser, file: Express.Multer.File | undefined): Promise<ProductImportReport> {
    const { report, products } = await this.validate(actor, file);
    if (report.errors.length || products.length === 0) {
      return report;
    }
    const saved = await this.productsService.createMany(actor, products);
    return { ...report, imported: saved.map(({ barcode, name }) => ({ code: barcode, name })) };
  }

  private async validate(
    actor: AuthUser,
    file: Express.Multer.File | undefined,
  ): Promise<{ report: ProductImportReport; products: CreateProductDto[] }> {
    const { report, rows } = await readImportFile<Field, ProductPreviewRow>(file, SHEET_NAME, COLUMNS, EXPORT_ONLY);
    if (report.errors.length) {
      return { report, products: [] };
    }

    const existing = await this.productsRepository.find({
      select: { name: true, barcode: true },
      where: { companyId: actor.companyId! },
    });
    const byName = new Map(existing.map((p) => [nameKey(p.name), p]));
    const { categories, suppliers } = await this.activeLists(actor);
    const categoryByName = new Map(categories.map((c) => [nameKey(c.name), c]));
    const supplierByName = new Map(suppliers.map((s) => [nameKey(s.name), s]));
    const listed = (names: string[], sheet: string, kind: string) =>
      names.length === 0
        ? `There are no active ${kind} yet.`
        : names.length <= 10
          ? `Active ${kind}: ${names.join(', ')}.`
          : `See the ${sheet} sheet of the template.`;
    const categoryList = listed(categories.map((c) => c.name), 'Categories', 'categories');
    const supplierList = listed(suppliers.map((s) => s.name), 'Suppliers', 'suppliers');
    const byBarcode = new Map(existing.map((p) => [p.barcode, p]));
    const firstRowByName = new Map<string, number>();
    const firstRowByBarcode = new Map<string, number>();

    const products: CreateProductDto[] = [];
    for (const sheetRow of rows) {
      const { row, values } = sheetRow;
      const errorCount = report.errors.length;
      const { error } = rowIssues(report, COLUMNS, sheetRow);
      const required = (field: Field, label: string) => {
        const value = values[field] ?? '';
        if (!value) {
          error(field, `${label} is required`);
        }
        return value;
      };
      const choice = <T>(field: Field, map: Record<string, T>, allowed: string, fallback?: T): T | undefined => {
        const text = values[field] ?? '';
        if (!text) {
          if (fallback === undefined) {
            error(field, `Required: ${allowed}`);
          }
          return fallback;
        }
        const value = map[choiceKey(text)];
        if (value === undefined) {
          error(field, `Must be ${allowed}`);
        }
        return value;
      };

      const name = required('name', 'Name');
      if (name) {
        const key = nameKey(name);
        const taken = byName.get(key);
        const firstRow = firstRowByName.get(key);
        if (taken) {
          error('name', `A product named "${taken.name}" already exists (barcode ${taken.barcode})`);
        } else if (firstRow !== undefined) {
          error('name', `Same name as row ${firstRow}; product names must be unique`);
        } else {
          firstRowByName.set(key, row);
        }
      }

      const barcode = required('barcode', 'Barcode');
      if (barcode) {
        const taken = byBarcode.get(barcode);
        const firstRow = firstRowByBarcode.get(barcode);
        if (sheetRow.numbers.barcode !== undefined && /e/i.test(barcode)) {
          error('barcode', 'Excel turned this barcode into a number in scientific notation. Format the column as Text and type it again.');
        } else if (taken) {
          error('barcode', `Barcode already used by "${taken.name}"`);
        } else if (firstRow !== undefined) {
          error('barcode', `Same barcode as row ${firstRow}`);
        } else {
          firstRowByBarcode.set(barcode, row);
        }
      }

      const categoryName = required('category', 'Category');
      const category = categoryName ? categoryByName.get(nameKey(categoryName)) : undefined;
      if (categoryName && !category) {
        error('category', `Not an active category. ${categoryList}`);
      }
      const group = required('group', 'Group');
      const supplierName = required('supplier', 'Supplier');
      const supplier = supplierName ? supplierByName.get(nameKey(supplierName)) : undefined;
      if (supplierName && !supplier) {
        error('supplier', `Not an active supplier. ${supplierList}`);
      }
      const unit = choice('unit', UNITS, 'pcs or kg');
      const usage = choice('usage', USAGES, 'For sale, Ingredient or Both');
      const posStatus = choice('posStatus', POS_STATUSES, 'Storage only or Available at POS', ProductPosStatus.STORAGE);
      const status = choice('status', STATUSES, 'Active or Not active', ProductStatus.ACTIVE);

      const prices = (['costPrice', 'salePrice'] as const).map((field) => {
        const label = field === 'costPrice' ? 'Cost price' : 'Sale price';
        if (!values[field]) {
          error(field, `${label} is required`);
          return null;
        }
        const price = priceOf(sheetRow, field);
        if (price === null) {
          error(field, `${label} must be a number of 0 or more with at most 2 decimals`);
        }
        return price;
      });

      if (report.errors.length === errorCount) {
        const product = {
          name,
          barcode,
          group,
          unit: unit!,
          usage: usage!,
          posStatus: posStatus!,
          status: status!,
          costPrice: prices[0]!,
          salePrice: prices[1]!,
        };
        products.push({ ...product, categoryId: category!.id, supplierId: supplier!.id });
        report.rows.push({ row, ...product, category: category!.name, supplier: supplier!.name });
      }
    }

    report.validRows = products.length;
    return { report, products };
  }

  private async activeLists(actor: AuthUser): Promise<{ categories: Category[]; suppliers: Supplier[] }> {
    const [categories, suppliers] = await Promise.all([
      this.categoriesRepository.find({
        where: { companyId: actor.companyId!, status: CategoryStatus.ACTIVE },
        order: { name: 'ASC' },
      }),
      this.suppliersRepository.find({
        where: { companyId: actor.companyId!, status: SupplierStatus.ACTIVE },
        order: { name: 'ASC' },
      }),
    ]);
    return { categories, suppliers };
  }
}
