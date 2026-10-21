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

  @Column()
  barcode!: string;

  @Column()
  category!: string;

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

  @Column({ name: 'cost_price', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  costPrice!: number;

  @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  salePrice!: number;

  @OneToMany(() => ProductWarehouse, (stock) => stock.product)
  stocks!: Relation<ProductWarehouse>[];

  quantity!: number;

  @AfterLoad()
  computeQuantity(): void {
    if (this.stocks) {
      this.quantity = Math.round(this.stocks.reduce((sum, s) => sum + s.quantity, 0) * 1000) / 1000;
    }
  }

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
