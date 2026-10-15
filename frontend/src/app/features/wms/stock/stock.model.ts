import { Product, ProductUnit } from '../products/product.model';
import { Warehouse } from '../warehouses/warehouse.model';

export type StockMovementKind =
  | 'opening'
  | 'receipt'
  | 'receipt_cancel'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_cancel';

export const STOCK_MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  opening: 'Opening balance',
  receipt: 'Receipt',
  receipt_cancel: 'Receipt cancelled',
  transfer_out: 'Transfer sent',
  transfer_in: 'Transfer received',
  transfer_cancel: 'Transfer cancelled',
};

// The page of the document a movement came from (null for opening balances).
export function movementDocumentLink(movement: StockMovement): string[] | null {
  if (!movement.documentId) {
    return null;
  }
  return movement.kind.startsWith('receipt')
    ? ['/wms/receipts', movement.documentId]
    : ['/wms/transfers', movement.documentId];
}

// One line of stock history: + came in, − went out.
export interface StockMovement {
  id: string;
  kind: StockMovementKind;
  quantity: number;
  balanceAfter: number;
  documentId: string | null;
  note: string | null;
  createdByName: string;
  createdAt: string;
  product: { id: string; name: string; barcode: string; unit: ProductUnit };
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>;
}

// A product in a warehouse (the warehouse's View page).
export interface WarehouseStockRow {
  productId: string;
  quantity: number;
  product: Pick<Product, 'id' | 'name' | 'barcode' | 'category' | 'group' | 'unit' | 'costPrice' | 'status'>;
}
