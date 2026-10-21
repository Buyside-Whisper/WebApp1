export interface RegisterSession {
  id: string;
  storeId: string;
  storeName: string;
  registerNo: number;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  status: 'open' | 'closed';
  openingCash: number;
  closingCash: number | null;
  salesCount: number;
  total: number;
}

export interface SaleLine {
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  number: number;
  total: number;
  createdAt: string;
  lines: SaleLine[];
}

export interface RegisterSessionDetail extends RegisterSession {
  sales: Sale[];
}

export interface RegisterAvailability {
  no: number;
  inUseBy: string | null;
}
