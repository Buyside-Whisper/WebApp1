import { ProductUnit } from '../products/product.model';

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  draft: 'Draft',
  in_transit: 'In transit',
  received: 'Received',
  cancelled: 'Cancelled',
};

export interface TransferLine {
  id: string;
  position: number;
  productId: string | null;
  quantity: number;
  receivedQuantity: number | null;
  product: { id: string; name: string; barcode: string; unit: ProductUnit } | null;
  rsName: string | null;
  rsBarcode: string | null;
  rsUnitId: number | null;
  rsUnit: string | null;
}

type WarehouseRef = { id: string; code: string; name: string };

export interface Transfer {
  id: string;
  number: number;
  code: string;
  status: TransferStatus;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  date: string;
  note: string | null;
  rsWaybillId: string | null;
  waybillNumber: string | null;
  rsClosedAt: string | null;
  lineCount: number;
  lines?: TransferLine[];
  createdByName: string;
  createdAt: string;
  sentByName: string | null;
  sentAt: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
}

export interface TransferPayload {
  fromWarehouseId: string;
  toWarehouseId: string;
  date: string;
  note: string | null;
  lines: { productId: string | null; quantity: number }[];
}
