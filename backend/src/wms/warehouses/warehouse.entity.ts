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

  @Column({ type: 'varchar', nullable: true })
  branch!: string | null;

  @Column()
  address!: string;

  productCount?: number;
  stockPcs?: number;
  stockKg?: number;
  totalCost?: number;

  @Column({
    type: 'enum',
    enum: WarehouseStatus,
    default: WarehouseStatus.ACTIVE,
  })
  status!: WarehouseStatus;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager!: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;

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
