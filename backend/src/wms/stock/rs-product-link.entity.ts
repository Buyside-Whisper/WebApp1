import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../companies/tenant.entity.js';
import { Product } from '../products/product.entity.js';

@Entity({ name: 'rs_product_links' })
@Unique(['companyId', 'sellerTin', 'goodsKey'])
export class RsProductLink extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'seller_tin' })
  sellerTin!: string;

  @Column({ name: 'goods_key' })
  goodsKey!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
