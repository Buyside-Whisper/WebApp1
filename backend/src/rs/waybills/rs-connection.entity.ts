import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';

@Entity({ name: 'rs_connections' })
@Unique(['companyId'])
export class RsConnection extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  username!: string;

  @Column({ name: 'password_encrypted' })
  passwordEncrypted!: string;

  @Column({ name: 'rs_un_id', type: 'int', nullable: true })
  rsUnId!: number | null;

  @Column({ name: 'rs_user_id', type: 'int', nullable: true })
  rsUserId!: number | null;

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt!: Date | null;

  @Column({ name: 'check_ok', default: false })
  checkOk!: boolean;

  @Column({ name: 'updated_by' })
  updatedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
