import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { Store } from '../stores/store.entity.js';
import { Sale } from './sale.entity.js';

@Index('UQ_open_register_session', ['storeId', 'registerNo'], { unique: true, where: '"closed_at" IS NULL' })
@Entity({ name: 'register_sessions' })
export class RegisterSession extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Relation<Store>;

  @Column({ name: 'cashier_id', type: 'uuid', nullable: true })
  cashierId!: string | null;

  @Column({ name: 'cashier_name' })
  cashierName!: string;

  @Column({ name: 'register_no', type: 'int' })
  registerNo!: number;

  @Column({ name: 'opening_cash', type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  openingCash!: number;

  @Column({
    name: 'closing_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  closingCash!: number | null;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @OneToMany(() => Sale, (sale) => sale.session)
  sales!: Sale[];
}
