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
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { ReceiptLine } from './receipt-line.entity.js';
import { ReceiptStatus } from './receipt-status.enum.js';

@Entity({ name: 'receipts' })
@Unique(['companyId', 'number'])
@Index('UQ_receipts_rs_waybill', ['companyId', 'rsWaybillId'], {
  unique: true,
  where: `"rs_waybill_id" IS NOT NULL AND "status" <> 'cancelled'`,
})
export class Receipt extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.DRAFT })
  status!: ReceiptStatus;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Relation<Warehouse>;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId!: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Pick<Supplier, 'id' | 'name' | 'identificationCode' | 'status'>;

  @Column({ name: 'rs_waybill_id', type: 'varchar', nullable: true })
  rsWaybillId!: string | null;

  @Column({ name: 'rs_seller_tin', type: 'varchar', nullable: true })
  rsSellerTin!: string | null;

  @Column({ name: 'rs_seller_name', type: 'varchar', nullable: true })
  rsSellerName!: string | null;

  @Column({ name: 'rs_confirmed_at', type: 'timestamptz', nullable: true })
  rsConfirmedAt!: Date | null;

  @Column({ name: 'waybill_number', type: 'varchar', nullable: true })
  waybillNumber!: string | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @OneToMany(() => ReceiptLine, (line) => line.receipt, { cascade: true })
  lines!: Relation<ReceiptLine>[];

  @Column({ name: 'created_by_name' })
  createdByName!: string;

  @Column({ name: 'posted_by_name', type: 'varchar', nullable: true })
  postedByName!: string | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt!: Date | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', nullable: true })
  cancelledByName!: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
