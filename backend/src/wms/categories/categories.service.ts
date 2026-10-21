import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { nameKey, nameKeySql } from '../../common/name-key.js';
import { Product } from '../products/product.entity.js';
import { Category } from './category.entity.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<Category[]> {
    const categories = await this.categoriesRepository.find({
      where: { companyId: actor.companyId! },
      order: { name: 'ASC' },
    });
    const counts: { categoryId: string; count: string }[] = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('product.company_id = :companyId', { companyId: actor.companyId })
      .groupBy('product.category_id')
      .getRawMany();
    const byId = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
    return categories.map((category) => Object.assign(category, { productCount: byId.get(category.id) ?? 0 }));
  }

  async create(actor: AuthUser, dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameFree(actor, dto.name);
    const saved = await this.categoriesRepository.save(
      this.categoriesRepository.create({ ...dto, companyId: actor.companyId! }),
    );
    await this.audit.record(actor, 'category.create', `Created category ${saved.name}`);
    return Object.assign(saved, { productCount: 0 });
  }

  async update(actor: AuthUser, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findEntity(actor, id);
    if (dto.name && nameKey(dto.name) !== nameKey(category.name)) {
      await this.assertNameFree(actor, dto.name, id);
    }
    Object.assign(
      category,
      Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    );
    const saved = await this.categoriesRepository.save(category);
    await this.audit.record(actor, 'category.update', `Updated category ${saved.name}`);
    return Object.assign(saved, { productCount: await this.productCount(actor, id) });
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const category = await this.findEntity(actor, id);
    const count = await this.productCount(actor, id);
    if (count > 0) {
      throw new ConflictException(
        `${category.name} has ${count} ${count === 1 ? 'product' : 'products'}, so it can't be deleted. Move them to another category or set it to Inactive.`,
      );
    }
    await this.categoriesRepository.remove(category);
    await this.audit.record(actor, 'category.delete', `Deleted category ${category.name}`);
  }

  private productCount(actor: AuthUser, categoryId: string): Promise<number> {
    return this.productsRepository.countBy({ companyId: actor.companyId!, categoryId });
  }

  private async findEntity(actor: AuthUser, id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOneBy({ id, companyId: actor.companyId! });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  private async assertNameFree(actor: AuthUser, name: string, exceptId?: string): Promise<void> {
    const query = this.categoriesRepository
      .createQueryBuilder('category')
      .where('category.company_id = :companyId', { companyId: actor.companyId })
      .andWhere(`${nameKeySql('category.name')} = :key`, { key: nameKey(name) });
    if (exceptId) {
      query.andWhere('category.id <> :exceptId', { exceptId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException(`A category named "${existing.name}" already exists`);
    }
  }
}
