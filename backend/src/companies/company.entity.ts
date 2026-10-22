import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppModuleName } from './app-module.enum.js';
import { CompanyStatus } from './company-status.enum.js';
import { LegalForm } from './legal-form.enum.js';

@Entity({ name: 'companies' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  modules!: AppModuleName[];

  @Column({ name: 'module_prices', type: 'jsonb', default: {} })
  modulePrices!: Partial<Record<AppModuleName, number>>;

  @Column({ name: 'legal_name', type: 'varchar', nullable: true })
  legalName!: string | null;

  @Column({ name: 'legal_form', type: 'enum', enum: LegalForm, nullable: true })
  legalForm!: LegalForm | null;

  @Column({ name: 'identification_code', type: 'varchar', nullable: true, unique: true })
  identificationCode!: string | null;

  @Column({ name: 'vat_payer', default: false })
  vatPayer!: boolean;

  @Column({ name: 'legal_address', type: 'varchar', nullable: true })
  legalAddress!: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.ACTIVE })
  status!: CompanyStatus;

  @Column({ name: 'subscription_start', type: 'date', nullable: true })
  subscriptionStart!: string | null;

  @Column({ name: 'trial_ends_on', type: 'date', nullable: true })
  trialEndsOn!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
