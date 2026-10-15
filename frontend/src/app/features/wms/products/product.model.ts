import { Warehouse } from '../warehouses/warehouse.model';

export type ProductStatus = 'active' | 'inactive';
export type ProductUsage = 'sale' | 'ingredient' | 'both';
export type ProductPosStatus = 'storage' | 'pos';
export type ProductUnit = 'kg' | 'pcs';

export const PRODUCT_USAGE_LABELS: Record<ProductUsage, string> = {
  sale: 'For sale',
  ingredient: 'Ingredient',
  both: 'Both',
};

export const PRODUCT_POS_STATUS_LABELS: Record<ProductPosStatus, string> = {
  storage: 'Storage only',
  pos: 'Available at POS',
};

export interface Product {
  id: string;
  name: string;
  barcode: string;
  // Broad category (Sweets) and the narrower group inside it (Chocolate).
  category: string;
  group: string;
  supplier: string;
  status: ProductStatus;
  usage: ProductUsage;
  posStatus: ProductPosStatus;
  // Sum of the warehouse quantities (computed by the backend).
  quantity: number;
  unit: ProductUnit;
  costPrice: number;
  salePrice: number;
  stocks: ProductStock[];
  createdAt: string;
  updatedAt: string;
}

// How much of the product one warehouse has (the current balance).
export interface ProductStock {
  warehouseId: string;
  quantity: number;
  warehouse: Warehouse;
}

// Stock (quantity / stocks) is read-only here: it changes only through stock documents.
// An active product as offered on receipt / transfer lines (GET /wms/products/options).
export type ProductOption = Pick<
  Product,
  'id' | 'name' | 'barcode' | 'unit' | 'costPrice' | 'category' | 'group' | 'supplier'
>;

export type ProductPayload = Omit<Product, 'id' | 'quantity' | 'stocks' | 'createdAt' | 'updatedAt'>;
