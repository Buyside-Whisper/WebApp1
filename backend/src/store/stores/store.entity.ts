import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { Employee } from '../../hr/employees/employee.entity.js';

@Entity({ name: 'stores' })
export class Store extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  address!: string;

  @Column({ type: 'int', default: 1 })
  registers!: number;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager!: Employee | null;

  @ManyToMany(() => Employee, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'store_employees',
    joinColumn: { name: 'store_id' },
    inverseJoinColumn: { name: 'employee_id' },
  })
  members!: Employee[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
