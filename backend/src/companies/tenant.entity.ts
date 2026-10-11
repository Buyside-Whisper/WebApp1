import { Column, JoinColumn, ManyToOne } from 'typeorm';
import { Company } from './company.entity.js';

export abstract class TenantEntity {
  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;
}
