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

// The product catalogue. Quantities are not edited here: they change only through stock
// documents (StockService), and come back read-only as `stocks` / `quantity`.
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
    // Existing quantities are in the old unit (e.g. 12.5 kg), so the unit is fixed while there is stock.
    if (dto.unit && dto.unit !== product.unit && product.stocks.some((stock) => stock.quantity !== 0)) {
      throw new BadRequestException(`The unit can't change while ${product.name} has stock`);
    }

    const { stocks, ...rest } = product;
    const saved = await this.save(Object.assign(rest as Product, this.trimmed(dto)));
    await this.audit.record(actor, 'product.update', `Updated product ${saved.barcode} ${saved.name}`);
    return this.findOne(actor, id);
  }

  // A product with stock history can't be deleted (the history would point at nothing); it can be
  // set to Not active instead.
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

  // Trims the text fields so " 123" and "123" count as the same barcode, and leaves out the fields
  // that were not sent (they would overwrite the loaded product with undefined).
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
