import {
  Column,
  CreateDateColumn,
  Entity,
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

// Transfer (გადაადგილება): goods moving from one warehouse to another, in two steps. Draft → Sent
// (stock leaves the source; In transit) → Received (the destination confirms what arrived; that
// goes into its stock). A transfer in transit can be cancelled (the goods go back to the source).
@Entity({ name: 'transfers' })
@Unique(['companyId', 'number'])
export class Transfer extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 1, 2, 3, … per company; shown as TR-000001.
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

  // The planned day (YYYY-MM-DD).
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

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
