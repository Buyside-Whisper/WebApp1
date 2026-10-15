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
  productId: string;
  quantity: number;
  unitCost: number;
  product: { id: string; name: string; barcode: string; unit: ProductUnit };
}

// Goods receipt (მიღება): goods from a supplier into one warehouse.
export interface Receipt {
  id: string;
  number: number;
  code: string; // REC-000001
  status: ReceiptStatus;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  supplier: string;
  waybillNumber: string | null;
  date: string;
  note: string | null;
  lineCount: number;
  total: number;
  lines?: ReceiptLine[]; // only on GET /:id
  createdByName: string;
  createdAt: string;
  postedByName: string | null;
  postedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
}

export interface ReceiptPayload {
  warehouseId: string;
  supplier: string;
  waybillNumber: string | null;
  date: string;
  note: string | null;
  lines: { productId: string; quantity: number; unitCost: number }[];
}
