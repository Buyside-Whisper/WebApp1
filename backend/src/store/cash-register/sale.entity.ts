import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../common/decimal.transformer.js';
import { RegisterSession } from './register-session.entity.js';
import { SaleLine } from './sale-line.entity.js';

@Entity({ name: 'sales' })
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => RegisterSession, (session) => session.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Relation<RegisterSession>;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  total!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => SaleLine, (line) => line.sale, { cascade: true })
  lines!: SaleLine[];
}
