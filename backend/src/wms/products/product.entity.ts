import {
  Column,
  CreateDateColumn,
  AfterLoad,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { ProductWarehouse } from '../stock/product-warehouse.entity.js';
import { ProductPosStatus } from './product-pos-status.enum.js';
import { ProductStatus } from './product-status.enum.js';
import { ProductUnit } from './product-unit.enum.js';
import { ProductUsage } from './product-usage.enum.js';

@Entity({ name: 'products' })
@Unique(['companyId', 'barcode'])
export class Product extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // შტრიხკოდი. Kept as text: barcodes can have leading zeros.
  @Column()
  barcode!: string;

  // Category is the broad one (Sweets), group the narrower one inside it (Chocolate).
  // Both plain text for now; may become relations once they get their own pages.
  @Column()
  category!: string;

  // "group" is an SQL keyword, so the column gets a different name.
  @Column({ name: 'product_group' })
  group!: string;

  @Column()
  supplier!: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status!: ProductStatus;

  @Column({ type: 'enum', enum: ProductUsage })
  usage!: ProductUsage;

  @Column({ name: 'pos_status', type: 'enum', enum: ProductPosStatus, default: ProductPosStatus.STORAGE })
  posStatus!: ProductPosStatus;

  @Column({ type: 'enum', enum: ProductUnit, default: ProductUnit.PCS })
  unit!: ProductUnit;

  // თვითღირებულება and გასაყიდი ფასი, per unit.
  @Column({ name: 'cost_price', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  costPrice!: number;

  @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  salePrice!: number;

  // The warehouses that have this product and how much each one has.
  @OneToMany(() => ProductWarehouse, (stock) => stock.product)
  stocks!: Relation<ProductWarehouse>[];

  // Not stored: the sum of the warehouse quantities (set when the stocks are loaded).
  quantity!: number;

  @AfterLoad()
  computeQuantity(): void {
    if (this.stocks) {
      // Rounded to 3 decimals so 0.1 + 0.2 doesn't show as 0.30000000000000004.
      this.quantity = Math.round(this.stocks.reduce((sum, s) => sum + s.quantity, 0) * 1000) / 1000;
    }
  }

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
