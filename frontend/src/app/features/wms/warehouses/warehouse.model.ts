import { ImportReport } from '../../../shared/xlsx-import/xlsx-import.model';

export type WarehouseType = 'main' | 'sales';
export type WarehouseStatus = 'active' | 'inactive';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  branch: string | null;
  address: string;
  status: WarehouseStatus;
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  stockPcs: number;
  stockKg: number;
  totalCost: number;
}

export interface WarehousePayload {
  name: string;
  type: WarehouseType;
  branch: string | null;
  address: string;
  status: WarehouseStatus;
  managerId: string | null;
}

export type WarehouseOption = Pick<Warehouse, 'id' | 'code' | 'name' | 'type' | 'status' | 'branch'> & {
  mine: boolean;
};

export interface ManagerOption {
  id: string;
  name: string;
}

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
