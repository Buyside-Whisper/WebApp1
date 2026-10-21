export type SupplierStatus = 'active' | 'inactive';
export type SupplierType = 'company' | 'individual';

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  company: 'Company',
  individual: 'Individual',
};

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  identificationCode: string | null;
  vatPayer: boolean;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: SupplierStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SupplierPayload = Omit<Supplier, 'id' | 'productCount' | 'createdAt' | 'updatedAt'>;
