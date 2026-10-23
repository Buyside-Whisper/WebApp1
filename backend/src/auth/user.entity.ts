import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppModuleName } from '../companies/app-module.enum.js';
import { Company } from '../companies/company.entity.js';
import { Employee } from '../hr/employees/employee.entity.js';
import { UserRole } from './user-role.enum.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'display_name' })
  displayName!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: AppModuleName,
    enumName: 'app_module',
    nullable: true,
  })
  module!: AppModuleName | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company | null;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId!: string | null;

  @Column({ type: 'varchar', length: 2, default: 'en' })
  language!: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
