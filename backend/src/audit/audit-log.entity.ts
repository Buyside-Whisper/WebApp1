import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Index()
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ name: 'actor_name' })
  actorName!: string;

  @Column({ name: 'actor_role' })
  actorRole!: string;

  @Column()
  action!: string;

  @Column({ type: 'text' })
  summary!: string;
}
