import { ProductUnit } from '../products/product.model';

export type ReceiptStatus = 'draft' | 'posted' | 'cancelled';

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  cancelled: 'Cancelled',
};

export interface ReceiptLine {
  id: string;
  position: number;
  productId: string | null;
  quantity: number;
  unitCost: number;
  product: { id: string; name: string; barcode: string; unit: ProductUnit } | null;
  rsName: string | null;
  rsBarcode: string | null;
  rsUnitId: number | null;
  rsUnit: string | null;
}

export const RS_UNIT_TO_PRODUCT_UNIT: Record<number, ProductUnit> = { 1: 'pcs', 2: 'kg' };

export interface RsReceiptLink {
  rsWaybillId: string;
  receiptId: string;
  code: string;
  status: ReceiptStatus;
}

export interface Receipt {
  id: string;
  number: number;
  code: string;
  status: ReceiptStatus;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  supplierId: string;
  supplier: { id: string; name: string; identificationCode: string | null; status: 'active' | 'inactive' };
  waybillNumber: string | null;
  rsWaybillId: string | null;
  rsConfirmedAt: string | null;
  date: string;
  note: string | null;
  lineCount: number;
  total: number;
  lines?: ReceiptLine[];
  createdByName: string;
  createdAt: string;
  postedByName: string | null;
  postedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
}

export interface ReceiptPayload {
  warehouseId: string;
  supplierId: string;
  waybillNumber: string | null;
  date: string;
  note: string | null;
  lines: { productId: string | null; quantity: number; unitCost: number }[];
}
