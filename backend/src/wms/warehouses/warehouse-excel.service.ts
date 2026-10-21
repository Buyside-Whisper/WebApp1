import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { AuthUser } from '../../auth/auth-user.js';
import { nameKey } from '../../common/name-key.js';
import {
  ImportReport,
  SheetColumn,
  addInstructionsSheet,
  addTableSheet,
  addTemplateSheet,
  choiceKey,
  readImportFile,
  rowIssues,
  addListDropdown,
  workbookBuffer,
} from '../../common/xlsx.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { EmployeeRole } from '../../hr/employees/employee-role.enum.js';
import { EmployeeStatus } from '../../hr/employees/employee-status.enum.js';
import { Warehouse } from './warehouse.entity.js';
import { WarehouseStatus } from './warehouse-status.enum.js';
import { WarehouseType } from './warehouse-type.enum.js';
import { NewWarehouse, WarehousesService } from './warehouses.service.js';

type Field = 'name' | 'type' | 'branch' | 'address' | 'manager' | 'status';

const SHEET_NAME = 'Warehouses';

const TYPE_LABELS: Record<WarehouseType, string> = {
  [WarehouseType.MAIN]: 'Main',
  [WarehouseType.SALES]: 'Sales',
};

const STATUS_LABELS: Record<WarehouseStatus, string> = {
  [WarehouseStatus.ACTIVE]: 'Active',
  [WarehouseStatus.INACTIVE]: 'Inactive',
};

const COLUMNS: SheetColumn<Field>[] = [
  { field: 'name', header: 'Name', aliases: ['warehouse', 'warehouse name', 'სახელი', 'საწყობი'], width: 28, required: true },
  { field: 'type', header: 'Type', aliases: ['ტიპი'], width: 12, required: true, choices: Object.values(TYPE_LABELS) },
  { field: 'branch', header: 'Branch', aliases: ['ფილიალი'], width: 18 },
  { field: 'address', header: 'Address', aliases: ['მისამართი'], width: 36, required: true },
  { field: 'manager', header: 'Manager', aliases: ['manager name', 'მენეჯერი'], width: 26 },
  { field: 'status', header: 'Status', aliases: ['სტატუსი'], width: 12, choices: Object.values(STATUS_LABELS) },
];

const EXPORT_ONLY = ['Code', 'Products', 'Stock', 'Total price'];

const TYPES: Record<string, WarehouseType> = {
  main: WarehouseType.MAIN,
  'main warehouse': WarehouseType.MAIN,
  'მთავარი': WarehouseType.MAIN,
  'მთავარი საწყობი': WarehouseType.MAIN,
  sales: WarehouseType.SALES,
  sale: WarehouseType.SALES,
  'sales warehouse': WarehouseType.SALES,
  'გასაყიდი': WarehouseType.SALES,
  'გასაყიდი საწყობი': WarehouseType.SALES,
};

const STATUSES: Record<string, WarehouseStatus> = {
  active: WarehouseStatus.ACTIVE,
  'აქტიური': WarehouseStatus.ACTIVE,
  inactive: WarehouseStatus.INACTIVE,
  'not active': WarehouseStatus.INACTIVE,
  'არააქტიური': WarehouseStatus.INACTIVE,
};

export interface WarehousePreviewRow {
  row: number;
  name: string;
  type: WarehouseType;
  branch: string | null;
  address: string;
  manager: string | null;
  status: WarehouseStatus;
}

export type WarehouseImportReport = ImportReport<WarehousePreviewRow>;

const fullName = (employee: Employee) => `${employee.firstName} ${employee.lastName}`;

@Injectable()
export class WarehouseExcelService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly warehousesService: WarehousesService,
  ) {}

  async export(actor: AuthUser): Promise<Buffer> {
    const warehouses = await this.warehousesService.findAll(actor);
    const workbook = new ExcelJS.Workbook();
    addTableSheet(
      workbook,
      SHEET_NAME,
      [
        { header: 'Code', width: 14 },
        { header: 'Name', width: 28 },
        { header: 'Type', width: 10 },
        { header: 'Branch', width: 18 },
        { header: 'Address', width: 36 },
        { header: 'Manager', width: 26 },
        { header: 'Status', width: 12 },
        { header: 'Products', width: 11 },
        { header: 'Stock', width: 12, numFmt: '#,##0.###' },
        { header: 'Total price', width: 14, numFmt: '#,##0.00' },
      ],
      warehouses.map((w) => [
        w.code,
        w.name,
        TYPE_LABELS[w.type],
        w.branch ?? '',
        w.address,
        w.manager ? `${w.manager.firstName} ${w.manager.lastName}` : '',
        STATUS_LABELS[w.status],
        w.productCount ?? 0,
        (w.stockPcs ?? 0) + (w.stockKg ?? 0),
        w.totalCost ?? 0,
      ]),
    );
    return workbookBuffer(workbook);
  }

  async template(actor: AuthUser): Promise<Buffer> {
    const managers = await this.wmsManagers(actor);
    const workbook = new ExcelJS.Workbook();
    const sheet = addTemplateSheet(workbook, SHEET_NAME, COLUMNS);
    addListDropdown(
      sheet,
      COLUMNS.findIndex(({ field }) => field === 'manager') + 1,
      'Managers',
      managers.length,
      'Choose a WMS manager from the list (see the Managers sheet)',
    );
    addInstructionsSheet(
      workbook,
      [
        ['Name', 'Yes', 'Must not repeat an existing warehouse or another row (capitals and extra spaces are ignored).', 'Vake Shop'],
        ['Type', 'Yes', 'Main (serves all branches) or Sales.', 'Sales'],
        ['Branch', 'For sales warehouses', 'Free text. Leave empty for main warehouses (it is ignored there).', 'Vake'],
        ['Address', 'Yes', 'Street and city.', '5 Chavchavadze Ave, Tbilisi'],
        ['Manager', 'No', 'Full name of an active WMS manager, as on the Managers sheet (pick it from the dropdown).', 'Ana Japaridze'],
        ['Status', 'No', 'Active or Inactive. Empty means Active.', 'Active'],
      ],
      [
        'Codes (WH-MAIN-01, WH-SALE-07, ...) are given automatically.',
        'Stock is not imported here: goods come in through a receipt.',
        `The sheet named "${SHEET_NAME}" is read (or the first sheet). Empty rows are skipped.`,
        'An exported warehouses file can be imported too: its extra columns (Code, Products, ...) are ignored.',
        'At most 1000 warehouses per file. If any row has an error, nothing is imported.',
      ],
    );
    addTableSheet(
      workbook,
      'Managers',
      [{ header: 'Manager', width: 30 }],
      managers.length
        ? managers.map((m) => [fullName(m)])
        : [['No active WMS managers yet. Add them in HR first, or leave the column empty.']],
    );
    return workbookBuffer(workbook);
  }

  async check(actor: AuthUser, file: Express.Multer.File | undefined): Promise<WarehouseImportReport> {
    return (await this.validate(actor, file)).report;
  }

  async import(actor: AuthUser, file: Express.Multer.File | undefined): Promise<WarehouseImportReport> {
    const { report, warehouses } = await this.validate(actor, file);
    if (report.errors.length || warehouses.length === 0) {
      return report;
    }
    const saved = await this.warehousesService.createMany(actor, warehouses);
    return { ...report, imported: saved.map(({ code, name }) => ({ code, name })) };
  }

  private async validate(
    actor: AuthUser,
    file: Express.Multer.File | undefined,
  ): Promise<{ report: WarehouseImportReport; warehouses: NewWarehouse[] }> {
    const { report, rows } = await readImportFile<Field, WarehousePreviewRow>(file, SHEET_NAME, COLUMNS, EXPORT_ONLY);
    if (report.errors.length) {
      return { report, warehouses: [] };
    }

    const existing = await this.warehousesRepository.find({
      select: { name: true, code: true },
      where: { companyId: actor.companyId! },
    });
    const existingByKey = new Map(existing.map((w) => [nameKey(w.name), w]));
    const managers = await this.wmsManagers(actor);
    const managersByName = new Map<string, Employee[]>();
    for (const manager of managers) {
      const key = nameKey(fullName(manager));
      managersByName.set(key, [...(managersByName.get(key) ?? []), manager]);
    }
    const managerList =
      managers.length === 0
        ? 'This company has no active WMS managers yet.'
        : managers.length <= 10
          ? `WMS managers: ${managers.map(fullName).join(', ')}.`
          : 'See the Managers sheet of the template.';
    const firstRowByKey = new Map<string, number>();

    const warehouses: NewWarehouse[] = [];
    for (const sheetRow of rows) {
      const { row, values } = sheetRow;
      const errorCount = report.errors.length;
      const { error, warning } = rowIssues(report, COLUMNS, sheetRow);

      const name = values.name ?? '';
      if (!name) {
        error('name', 'Name is required');
      } else {
        const key = nameKey(name);
        const taken = existingByKey.get(key);
        const firstRow = firstRowByKey.get(key);
        if (taken) {
          error('name', `A warehouse named "${taken.name}" already exists (${taken.code})`);
        } else if (firstRow !== undefined) {
          error('name', `Same name as row ${firstRow}; warehouse names must be unique`);
        } else {
          firstRowByKey.set(key, row);
        }
      }

      const typeText = values.type ?? '';
      const type = TYPES[choiceKey(typeText)];
      if (!typeText) {
        error('type', 'Type is required: Main or Sales');
      } else if (!type) {
        error('type', 'Type must be Main or Sales');
      }

      let branch: string | null = values.branch || null;
      if (type === WarehouseType.SALES && !branch) {
        error('branch', 'A sales warehouse needs a branch');
      } else if (type === WarehouseType.MAIN && branch) {
        warning('branch', 'Ignored: a main warehouse serves all branches');
        branch = null;
      }

      const address = values.address ?? '';
      if (!address) {
        error('address', 'Address is required');
      }

      let managerId: string | null = null;
      let managerName: string | null = null;
      if (values.manager) {
        const matches = managersByName.get(nameKey(values.manager)) ?? [];
        if (matches.length === 0) {
          error('manager', `Not an active WMS manager. ${managerList}`);
        } else if (matches.length > 1) {
          error('manager', `${matches.length} WMS managers have this name. Leave it empty and pick the manager with Edit after the import.`);
        } else {
          managerId = matches[0].id;
          managerName = fullName(matches[0]);
        }
      }

      const statusText = values.status ?? '';
      const status = statusText ? STATUSES[choiceKey(statusText)] : WarehouseStatus.ACTIVE;
      if (!status) {
        error('status', 'Status must be Active or Inactive (or empty for Active)');
      }

      if (report.errors.length === errorCount) {
        warehouses.push({ name, type, branch, address, status, managerId });
        report.rows.push({ row, name, type, branch, address, manager: managerName, status });
      }
    }

    report.validRows = warehouses.length;
    return { report, warehouses };
  }

  private async wmsManagers(actor: AuthUser): Promise<Employee[]> {
    const managers = await this.employeesRepository.find({
      where: { companyId: actor.companyId!, role: EmployeeRole.MANAGER, module: AppModuleName.WMS },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return managers.filter((manager) => manager.status === EmployeeStatus.ACTIVE);
  }
}
