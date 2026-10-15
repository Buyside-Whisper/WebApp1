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

// One line of stock history: this much of a product came into (+) or left (−) a warehouse, why,
// and who did it. Never edited or deleted; a mistake is corrected by another movement.
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

  // NO ACTION: a product or warehouse with history can't be deleted (the services say so nicely),
  // but deleting a whole company still removes everything in one go.
  @ManyToOne(() => Product, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product>;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Relation<Warehouse>;

  // Signed change in the product's unit: positive = in, negative = out.
  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity!: number;

  // The warehouse's quantity of this product right after this movement.
  @Column({ name: 'balance_after', type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  balanceAfter!: number;

  // The document this came from (filled once documents exist), and a free note.
  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  // Kept as text so the history still reads right after the person leaves.
  @Column({ name: 'created_by_name' })
  createdByName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
