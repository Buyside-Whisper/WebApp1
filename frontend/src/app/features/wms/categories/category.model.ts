export type CategoryStatus = 'active' | 'inactive';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  status: CategoryStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: string;
  description: string | null;
  status: CategoryStatus;
}
