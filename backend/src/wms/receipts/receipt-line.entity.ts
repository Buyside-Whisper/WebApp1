import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Product } from '../products/product.entity.js';
import { Receipt } from './receipt.entity.js';

// One product on a receipt: how much arrived and what it cost per unit.
@Entity({ name: 'receipt_lines' })
export class ReceiptLine extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId!: string;

  @ManyToOne(() => Receipt, (receipt) => receipt.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt?: Relation<Receipt>;

  // Order on the document, as entered.
  @Column({ type: 'int' })
  position!: number;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product>;

  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity!: number;

  // Purchase price per unit on this delivery (feeds the product's weighted average cost).
  @Column({ name: 'unit_cost', type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  unitCost!: number;
}
