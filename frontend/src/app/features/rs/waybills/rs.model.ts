export type RsConfirmation = 'pending' | 'accepted' | 'rejected';

export const RS_STATUS_LABELS: Record<string, string> = {
  '0': 'Saved',
  '1': 'Active',
  '2': 'Closed',
  '-1': 'Deleted',
  '-2': 'Cancelled',
};

export const RS_STATUS_BADGES: Record<string, string> = {
  '0': 'badge--draft',
  '1': 'badge--transit',
  '2': 'badge--done',
  '-1': 'badge--inactive',
  '-2': 'badge--cancelled',
};

export const RS_CONFIRMATION_LABELS: Record<RsConfirmation, string> = {
  pending: 'Waiting for you',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export const RS_CONFIRMATION_BADGES: Record<RsConfirmation, string> = {
  pending: 'badge--draft',
  accepted: 'badge--done',
  rejected: 'badge--cancelled',
};

export interface RsConnection {
  connected: boolean;
  username: string | null;
  rsUnId: number | null;
  checkedAt: string | null;
  checkOk: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface RsWaybillSummary {
  id: string;
  number: string;
  typeId: number | null;
  typeName: string | null;
  status: number | null;
  confirmation: RsConfirmation;
  sellerTin: string | null;
  sellerName: string | null;
  buyerTin: string | null;
  buyerName: string | null;
  startAddress: string | null;
  endAddress: string | null;
  driverName: string | null;
  driverTin: string | null;
  carNumber: string | null;
  amount: number;
  transportCost: number;
  createdAt: string | null;
  activatedAt: string | null;
  deliveredAt: string | null;
  comment: string | null;
  parentId: string | null;
  corrected: boolean;
}

export interface RsWaybillGoods {
  name: string;
  barcode: string | null;
  unitId: number | null;
  unitName: string | null;
  quantity: number;
  price: number;
  amount: number;
}

export interface RsWaybillDetail extends RsWaybillSummary {
  amountInWords: string | null;
  transportName: string | null;
  confirmedAt: string | null;
  invoiceId: string | null;
  totalQuantity: number | null;
  goods: RsWaybillGoods[];
}

export const RS_PURCHASE_TYPES = [2, 3, 6];

export const RS_INTERNAL_TYPE = 1;

export interface RsReceiptLink {
  rsWaybillId: string;
  receiptId: string;
  code: string;
  status: 'draft' | 'posted' | 'cancelled';
}

export interface RsTransferLink {
  rsWaybillId: string;
  transferId: string;
  code: string;
  status: 'draft' | 'in_transit' | 'received' | 'cancelled';
}

export interface RsDocumentLink {
  kind: 'receipt' | 'transfer';
  id: string;
  code: string;
  statusLabel: string;
  posted: boolean;
}

export interface RsWarehouseChoice {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  mine: boolean;
}

export interface RsWaybillList {
  waybills: RsWaybillSummary[];
  fetchedAt: string;
}
