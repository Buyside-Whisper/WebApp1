import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { SupplierStatus } from './supplier-status.enum.js';
import { SupplierType } from './supplier-type.enum.js';

@Entity({ name: 'suppliers' })
@Unique(['companyId', 'identificationCode'])
export class Supplier extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: SupplierType, default: SupplierType.COMPANY })
  type!: SupplierType;

  @Column({ name: 'identification_code', type: 'varchar', nullable: true })
  identificationCode!: string | null;

  @Column({ name: 'vat_payer', default: false })
  vatPayer!: boolean;

  @Column({ name: 'contact_person', type: 'varchar', nullable: true })
  contactPerson!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'enum', enum: SupplierStatus, default: SupplierStatus.ACTIVE })
  status!: SupplierStatus;

  productCount?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
