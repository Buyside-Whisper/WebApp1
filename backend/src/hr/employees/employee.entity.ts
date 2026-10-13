import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { EmployeeRole } from './employee-role.enum.js';
import { EmployeeStatus } from './employee-status.enum.js';

@Entity({ name: 'employees' })
@Unique(['companyId', 'personalId'])
export class Employee extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({
    name: 'personal_id',
    type: 'varchar',
    length: 11,
    nullable: true,
  })
  personalId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate!: string | null;

  @Column({ type: 'varchar', nullable: true })
  position!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'enum', enum: EmployeeRole, nullable: true })
  role!: EmployeeRole | null;

  @Column({
    type: 'enum',
    enum: AppModuleName,
    enumName: 'app_module',
    nullable: true,
  })
  module!: AppModuleName | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  status!: EmployeeStatus;

  username?: string | null;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  computeStatus(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.status =
      this.endDate && this.endDate <= today
        ? EmployeeStatus.FORMER
        : EmployeeStatus.ACTIVE;
  }
}
