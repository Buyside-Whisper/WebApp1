import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { WarehouseStatus } from './warehouse-status.enum.js';
import { WarehouseType } from './warehouse-type.enum.js';

@Entity({ name: 'warehouses' })
@Unique(['companyId', 'code'])
export class Warehouse extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  code!: string;

  @Column({ type: 'enum', enum: WarehouseType })
  type!: WarehouseType;

  // One branch per warehouse, since a warehouse has one address. Free text for now.
  @Column({ type: 'varchar', nullable: true })
  branch!: string | null;

  @Column()
  address!: string;

  // Not stored: worked out from the products in this warehouse (WarehousesService.withTotals).
  // Stock is split by unit because kg and pcs can't be added together.
  productCount?: number;
  stockPcs?: number;
  stockKg?: number;
  // What the goods cost: sum of quantity × cost price.
  totalCost?: number;

  @Column({
    type: 'enum',
    enum: WarehouseStatus,
    default: WarehouseStatus.ACTIVE,
  })
  status!: WarehouseStatus;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  // One manager per warehouse; one manager can run several warehouses. An HR employee with the
  // manager role in the WMS module. The service replaces this with just the name (no personal data).
  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager!: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;

  // People who work in this warehouse (HR: a WMS manager picks the warehouses when he adds
  // someone). It decides whose records a manager sees in HR. Never returned by this API.
  @ManyToMany(() => Employee, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'warehouse_employees',
    joinColumn: { name: 'warehouse_id' },
    inverseJoinColumn: { name: 'employee_id' },
  })
  members!: Employee[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
