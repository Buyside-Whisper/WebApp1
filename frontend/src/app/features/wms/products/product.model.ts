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
  category: string;
  group: string;
  supplier: string;
  status: ProductStatus;
  usage: ProductUsage;
  posStatus: ProductPosStatus;
  quantity: number;
  unit: ProductUnit;
  costPrice: number;
  salePrice: number;
  stocks: ProductStock[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductStock {
  warehouseId: string;
  quantity: number;
  warehouse: Warehouse;
}

export type ProductOption = Pick<
  Product,
  'id' | 'name' | 'barcode' | 'unit' | 'costPrice' | 'category' | 'group' | 'supplier'
>;

export type ProductPayload = Omit<Product, 'id' | 'quantity' | 'stocks' | 'createdAt' | 'updatedAt'>;
