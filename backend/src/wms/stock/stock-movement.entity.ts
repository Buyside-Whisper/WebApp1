import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Product } from '../products/product.entity.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { StockMovementKind } from './stock-movement-kind.enum.js';

@Entity({ name: 'stock_movements' })
@Index(['companyId', 'productId', 'createdAt'])
@Index(['companyId', 'warehouseId', 'createdAt'])
export class StockMovement extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: StockMovementKind })
  kind!: StockMovementKind;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product>;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Relation<Warehouse>;

  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity!: number;

  @Column({ name: 'balance_after', type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  balanceAfter!: number;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_name' })
  createdByName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
