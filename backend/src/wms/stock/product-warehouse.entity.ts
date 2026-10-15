import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { Product } from '../products/product.entity.js';

// The current balance: how much of a product one warehouse has. Only StockService.post changes it,
// always together with a StockMovement row that says why.
@Entity({ name: 'product_warehouses' })
export class ProductWarehouse extends TenantEntity {
  @PrimaryColumn({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @PrimaryColumn({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Product, (product) => product.stocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product>;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Relation<Warehouse>;

  // In the product's unit: up to 3 decimals for kg, whole numbers for pcs (checked in the service).
  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0, transformer: decimalTransformer })
  quantity!: number;
}
