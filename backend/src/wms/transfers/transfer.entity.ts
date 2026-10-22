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
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { TransferLine } from './transfer-line.entity.js';
import { TransferStatus } from './transfer-status.enum.js';

@Entity({ name: 'transfers' })
@Unique(['companyId', 'number'])
@Index('UQ_transfers_rs_waybill', ['companyId', 'rsWaybillId'], {
  unique: true,
  where: `"rs_waybill_id" IS NOT NULL AND "status" <> 'cancelled'`,
})
export class Transfer extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'enum', enum: TransferStatus, default: TransferStatus.DRAFT })
  status!: TransferStatus;

  @Column({ name: 'from_warehouse_id', type: 'uuid' })
  fromWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'from_warehouse_id' })
  fromWarehouse?: Relation<Warehouse>;

  @Column({ name: 'to_warehouse_id', type: 'uuid' })
  toWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'to_warehouse_id' })
  toWarehouse?: Relation<Warehouse>;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'rs_waybill_id', type: 'varchar', nullable: true })
  rsWaybillId!: string | null;

  @Column({ name: 'waybill_number', type: 'varchar', nullable: true })
  waybillNumber!: string | null;

  @Column({ name: 'rs_seller_tin', type: 'varchar', nullable: true })
  rsSellerTin!: string | null;

  @Column({ name: 'rs_closed_at', type: 'timestamptz', nullable: true })
  rsClosedAt!: Date | null;

  @OneToMany(() => TransferLine, (line) => line.transfer, { cascade: true })
  lines!: Relation<TransferLine>[];

  @Column({ name: 'created_by_name' })
  createdByName!: string;

  @Column({ name: 'sent_by_name', type: 'varchar', nullable: true })
  sentByName!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'received_by_name', type: 'varchar', nullable: true })
  receivedByName!: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', nullable: true })
  cancelledByName!: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
