import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { Company } from '../../companies/company.entity.js';
import { PaymentMethod } from './payment-method.enum.js';

@Entity({ name: 'company_payments' })
export class CompanyPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'paid_on', type: 'date' })
  paidOn!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;

  @Column({ name: 'period_from', type: 'date' })
  periodFrom!: string;

  @Column({ name: 'period_to', type: 'date' })
  periodTo!: string;

  @Column({ type: 'varchar', nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'recorded_by' })
  recordedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
