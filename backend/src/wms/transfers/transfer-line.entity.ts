import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Product } from '../products/product.entity.js';
import { Transfer } from './transfer.entity.js';

@Entity({ name: 'transfer_lines' })
export class TransferLine extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transfer_id', type: 'uuid' })
  transferId!: string;

  @ManyToOne(() => Transfer, (transfer) => transfer.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer?: Relation<Transfer>;

  @Column({ type: 'int' })
  position!: number;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @ManyToOne(() => Product, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product?: Relation<Product>;

  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity!: number;

  @Column({ name: 'received_quantity', type: 'numeric', precision: 12, scale: 3, nullable: true, transformer: decimalTransformer })
  receivedQuantity!: number | null;

  @Column({ name: 'rs_name', type: 'varchar', nullable: true })
  rsName!: string | null;

  @Column({ name: 'rs_barcode', type: 'varchar', nullable: true })
  rsBarcode!: string | null;

  @Column({ name: 'rs_unit_id', type: 'int', nullable: true })
  rsUnitId!: number | null;

  @Column({ name: 'rs_unit', type: 'varchar', nullable: true })
  rsUnit!: string | null;
}
