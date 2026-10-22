import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { isUniqueViolation } from '../../common/is-unique-violation.js';
import { nameKey, nameKeySql } from '../../common/name-key.js';
import { Product } from '../products/product.entity.js';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto.js';
import { Supplier } from './supplier.entity.js';
import { SupplierStatus } from './supplier-status.enum.js';
import { SupplierType } from './supplier-type.enum.js';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser): Promise<Supplier[]> {
    const suppliers = await this.suppliersRepository.find({
      where: { companyId: actor.companyId! },
      order: { name: 'ASC' },
    });
    const counts: { supplierId: string; count: string }[] = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.supplier_id', 'supplierId')
      .addSelect('COUNT(*)', 'count')
      .where('product.company_id = :companyId', { companyId: actor.companyId })
      .groupBy('product.supplier_id')
      .getRawMany();
    const byId = new Map(counts.map((row) => [row.supplierId, Number(row.count)]));
    return suppliers.map((supplier) => Object.assign(supplier, { productCount: byId.get(supplier.id) ?? 0 }));
  }

  options(actor: AuthUser): Promise<Pick<Supplier, 'id' | 'name' | 'identificationCode'>[]> {
    return this.suppliersRepository.find({
      select: { id: true, name: true, identificationCode: true },
      where: { companyId: actor.companyId!, status: SupplierStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async create(actor: AuthUser, dto: CreateSupplierDto): Promise<Supplier> {
    await this.assertNameFree(actor, dto.name);
    const supplier = this.suppliersRepository.create({ ...dto, companyId: actor.companyId! });
    this.assertCodeFitsType(supplier);
    const saved = await this.save(supplier);
    await this.audit.record(actor, 'supplier.create', `Created supplier ${saved.name}`);
    return Object.assign(saved, { productCount: 0 });
  }

  async update(actor: AuthUser, id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findEntity(actor, id);
    if (dto.name && nameKey(dto.name) !== nameKey(supplier.name)) {
      await this.assertNameFree(actor, dto.name, id);
    }
    Object.assign(
      supplier,
      Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    );
    this.assertCodeFitsType(supplier);
    const saved = await this.save(supplier);
    await this.audit.record(actor, 'supplier.update', `Updated supplier ${saved.name}`);
    return Object.assign(saved, { productCount: await this.productCount(actor, id) });
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    const supplier = await this.findEntity(actor, id);
    const count = await this.productCount(actor, id);
    if (count > 0) {
      throw new ConflictException(
        `${supplier.name} supplies ${count} ${count === 1 ? 'product' : 'products'}, so it can't be deleted. Move them to another supplier or set it to Inactive.`,
      );
    }
    await this.suppliersRepository.remove(supplier);
    await this.audit.record(actor, 'supplier.delete', `Deleted supplier ${supplier.name}`);
  }

  private assertCodeFitsType(supplier: Supplier): void {
    const code = supplier.identificationCode;
    if (code && supplier.type === SupplierType.COMPANY && code.length !== 9) {
      throw new BadRequestException("A company's identification code has 9 digits");
    }
    if (code && supplier.type === SupplierType.INDIVIDUAL && code.length !== 11) {
      throw new BadRequestException("An individual's identification code is the 11-digit personal ID");
    }
  }

  private async save(supplier: Supplier): Promise<Supplier> {
    try {
      return await this.suppliersRepository.save(supplier);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Identification code ${supplier.identificationCode} is already used by another supplier`,
        );
      }
      throw error;
    }
  }

  private productCount(actor: AuthUser, supplierId: string): Promise<number> {
    return this.productsRepository.countBy({ companyId: actor.companyId!, supplierId });
  }

  private async findEntity(actor: AuthUser, id: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOneBy({ id, companyId: actor.companyId! });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return supplier;
  }

  private async assertNameFree(actor: AuthUser, name: string, exceptId?: string): Promise<void> {
    const query = this.suppliersRepository
      .createQueryBuilder('supplier')
      .where('supplier.company_id = :companyId', { companyId: actor.companyId })
      .andWhere(`${nameKeySql('supplier.name')} = :key`, { key: nameKey(name) });
    if (exceptId) {
      query.andWhere('supplier.id <> :exceptId', { exceptId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException(`A supplier named "${existing.name}" already exists`);
    }
  }
}
