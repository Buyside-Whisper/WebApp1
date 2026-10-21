import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { StockService } from '../stock/stock.service.js';
import { Product } from './product.entity.js';
import { ProductStatus } from './product-status.enum.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

export type ProductOption = Pick<
  Product,
  'id' | 'name' | 'barcode' | 'unit' | 'costPrice' | 'category' | 'group' | 'supplier'
>;

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly stockService: StockService,
    private readonly audit: AuditService,
  ) {}

  findAll(actor: AuthUser): Promise<Product[]> {
    return this.productsRepository.find({
      where: { companyId: actor.companyId! },
      relations: { stocks: { warehouse: true } },
      order: { name: 'ASC', stocks: { warehouse: { code: 'ASC' } } },
    });
  }

  options(actor: AuthUser): Promise<ProductOption[]> {
    return this.productsRepository.find({
      select: { id: true, name: true, barcode: true, unit: true, costPrice: true, category: true, group: true, supplier: true },
      where: { companyId: actor.companyId!, status: ProductStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async findOne(actor: AuthUser, id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { stocks: { warehouse: true } },
      order: { stocks: { warehouse: { code: 'ASC' } } },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async create(actor: AuthUser, dto: CreateProductDto): Promise<Product> {
    await this.assertNameFree(actor, dto.name);
    const product = this.productsRepository.create({
      ...this.trimmed(dto),
      companyId: actor.companyId!,
    });
    const saved = await this.save(product);
    await this.audit.record(actor, 'product.create', `Created product ${saved.barcode} ${saved.name}`);
    return this.findOne(actor, saved.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(actor, id);
    if (dto.unit && dto.unit !== product.unit && product.stocks.some((stock) => stock.quantity !== 0)) {
      throw new BadRequestException(`The unit can't change while ${product.name} has stock`);
    }

    if (dto.name && nameKey(dto.name) !== nameKey(product.name)) {
      await this.assertNameFree(actor, dto.name, id);
    }

    const { stocks, ...rest } = product;
    const saved = await this.save(Object.assign(rest as Product, this.trimmed(dto)));
    await this.audit.record(actor, 'product.update', `Updated product ${saved.barcode} ${saved.name}`);
    return this.findOne(actor, id);
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const product = await this.findOne(actor, id);
    if (await this.stockService.hasHistory(actor, { productId: id })) {
      throw new ConflictException(
        `${product.name} has stock history, so it can't be deleted. Set it to Not active instead.`,
      );
    }
    await this.productsRepository.delete({ id, companyId: actor.companyId! });
    await this.audit.record(actor, 'product.delete', `Deleted product ${product.barcode} ${product.name}`);
  }

  private async assertNameFree(actor: AuthUser, name: string, exceptId?: string): Promise<void> {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .where('product.company_id = :companyId', { companyId: actor.companyId })
      .andWhere(`LOWER(REGEXP_REPLACE(TRIM(product.name), '\\s+', ' ', 'g')) = :key`, { key: nameKey(name) });
    if (exceptId) {
      query.andWhere('product.id <> :exceptId', { exceptId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException(
        `A product named "${existing.name}" already exists (barcode ${existing.barcode})`,
      );
    }
  }

  private async save(product: Product): Promise<Product> {
    try {
      return await this.productsRepository.save(product);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Barcode ${product.barcode} is already used by another product`);
      }
      throw error;
    }
  }

  private trimmed<T extends object>(dto: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        result[key] = typeof value === 'string' ? value.trim() : value;
      }
    }
    return result as T;
  }
}
