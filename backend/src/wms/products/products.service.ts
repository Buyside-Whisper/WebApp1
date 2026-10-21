import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { nameKey, nameKeySql } from '../../common/name-key.js';
import { Category } from '../categories/category.entity.js';
import { CategoryStatus } from '../categories/category-status.enum.js';
import { StockService } from '../stock/stock.service.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { SupplierStatus } from '../suppliers/supplier-status.enum.js';
import { Product } from './product.entity.js';
import { ProductStatus } from './product-status.enum.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

export type ProductOption = Pick<
  Product,
  'id' | 'name' | 'barcode' | 'unit' | 'costPrice' | 'category' | 'group' | 'supplier'
>;

function withShortReferences(product: Product): Product {
  if (product.category) {
    const { id, name, status } = product.category;
    product.category = { id, name, status };
  }
  if (product.supplier) {
    const { id, name, status } = product.supplier;
    product.supplier = { id, name, status };
  }
  return product;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    private readonly stockService: StockService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<Product[]> {
    const products = await this.productsRepository.find({
      where: { companyId: actor.companyId! },
      relations: { stocks: { warehouse: true }, category: true, supplier: true },
      order: { name: 'ASC', stocks: { warehouse: { code: 'ASC' } } },
    });
    return products.map(withShortReferences);
  }

  async options(actor: AuthUser): Promise<ProductOption[]> {
    const products = await this.productsRepository.find({
      where: { companyId: actor.companyId!, status: ProductStatus.ACTIVE },
      relations: { category: true, supplier: true },
      order: { name: 'ASC' },
    });
    return products.map((product) => {
      const { id, name, barcode, unit, costPrice, category, group, supplier } = withShortReferences(product);
      return { id, name, barcode, unit, costPrice, category, group, supplier };
    });
  }

  async findOne(actor: AuthUser, id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, companyId: actor.companyId! },
      relations: { stocks: { warehouse: true }, category: true, supplier: true },
      order: { stocks: { warehouse: { code: 'ASC' } } },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return withShortReferences(product);
  }

  async create(actor: AuthUser, dto: CreateProductDto): Promise<Product> {
    await this.assertNameFree(actor, dto.name);
    await this.assertCategoryUsable(actor, dto.categoryId);
    await this.assertSupplierUsable(actor, dto.supplierId);
    const product = this.productsRepository.create({
      ...this.trimmed(dto),
      companyId: actor.companyId!,
    });
    const saved = await this.save(product);
    await this.audit.record(actor, 'product.create', `Created product ${saved.barcode} ${saved.name}`);
    return this.findOne(actor, saved.id);
  }

  async createMany(actor: AuthUser, rows: CreateProductDto[]): Promise<Product[]> {
    const saved = await this.productsRepository.manager.transaction(async (manager) => {
      const created: Product[] = [];
      for (const row of rows) {
        try {
          created.push(await manager.save(manager.create(Product, { ...this.trimmed(row), companyId: actor.companyId! })));
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(`Barcode ${row.barcode} is already used by another product`);
          }
          throw error;
        }
      }
      return created;
    });
    await this.audit.record(actor, 'product.import', `Imported ${saved.length} products`);
    return saved;
  }

  async update(actor: AuthUser, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(actor, id);
    if (dto.unit && dto.unit !== product.unit && product.stocks.some((stock) => stock.quantity !== 0)) {
      throw new BadRequestException(`The unit can't change while ${product.name} has stock`);
    }

    if (dto.name && nameKey(dto.name) !== nameKey(product.name)) {
      await this.assertNameFree(actor, dto.name, id);
    }
    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      await this.assertCategoryUsable(actor, dto.categoryId);
    }
    if (dto.supplierId && dto.supplierId !== product.supplierId) {
      await this.assertSupplierUsable(actor, dto.supplierId);
    }

    const { stocks, category, supplier, ...rest } = product;
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
      .andWhere(`${nameKeySql('product.name')} = :key`, { key: nameKey(name) });
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

  private async assertCategoryUsable(actor: AuthUser, id: string): Promise<void> {
    const category = await this.categoriesRepository.findOneBy({ id, companyId: actor.companyId! });
    if (!category) {
      throw new BadRequestException('Choose a category from the list');
    }
    if (category.status !== CategoryStatus.ACTIVE) {
      throw new BadRequestException(`The category ${category.name} is inactive`);
    }
  }

  private async assertSupplierUsable(actor: AuthUser, id: string): Promise<void> {
    const supplier = await this.suppliersRepository.findOneBy({ id, companyId: actor.companyId! });
    if (!supplier) {
      throw new BadRequestException('Choose a supplier from the list');
    }
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new BadRequestException(`The supplier ${supplier.name} is inactive`);
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
