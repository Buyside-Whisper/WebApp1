import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Sale } from './sale.entity.js';

@Entity({ name: 'sale_lines' })
export class SaleLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sale, (sale) => sale.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Relation<Sale>;

  @Column({ name: 'product_name' })
  productName!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  unitPrice!: number;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  lineTotal!: number;
}
