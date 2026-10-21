import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../../auth/auth-user.js';
import { Sale } from '../cash-register/sale.entity.js';
import { CashRegisterService } from '../cash-register/cash-register.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { StoreProduct } from './store-product.entity.js';

const SAMPLE_PRODUCTS: { name: string; price: number }[] = [
  { name: 'Espresso', price: 4.5 },
  { name: 'Cappuccino', price: 6 },
  { name: 'Black Tea', price: 3.5 },
  { name: 'Mineral Water 0.5L', price: 1.8 },
  { name: 'Lemonade', price: 5 },
  { name: 'Khachapuri', price: 12 },
  { name: 'Croissant', price: 4 },
  { name: 'Chocolate Bar', price: 3.2 },
  { name: 'Churchkhela', price: 2.5 },
  { name: 'Sulguni Sandwich', price: 9.5 },
];

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(StoreProduct)
    private readonly productsRepository: Repository<StoreProduct>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    private readonly cashRegister: CashRegisterService,
    private readonly audit: AuditService,
  ) {}

  products(actor: AuthUser): Promise<StoreProduct[]> {
    return this.productsRepository.find({
      where: { companyId: actor.companyId! },
      order: { name: 'ASC' },
    });
  }

  async ensureSampleProducts(companyId: string): Promise<void> {
    if (await this.productsRepository.existsBy({ companyId })) {
      return;
    }
    await this.productsRepository.save(
      SAMPLE_PRODUCTS.map((product) =>
        this.productsRepository.create({ ...product, companyId }),
      ),
    );
  }

  async createSale(actor: AuthUser, dto: CreateSaleDto): Promise<Sale> {
    const session = await this.cashRegister.findOpenSession(actor);
    if (!session) {
      throw new BadRequestException(
        'Open a register first (Store → Cash register)',
      );
    }

    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const products = await this.productsRepository.findBy({
      id: In([...quantities.keys()]),
      companyId: actor.companyId!,
    });
    if (products.length !== quantities.size) {
      throw new BadRequestException('One or more products do not exist');
    }

    const lines = products.map((product) => {
      const quantity = quantities.get(product.id)!;
      return {
        productName: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal: round(product.price * quantity),
      };
    });
    const total = round(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const number =
      (await this.salesRepository.countBy({ sessionId: session.id })) + 1;

    const sale = await this.salesRepository.save(
      this.salesRepository.create({
        sessionId: session.id,
        number,
        total,
        lines,
      }),
    );
    await this.audit.record(
      actor,
      'sale.create',
      `Sale #${number} of ${total.toFixed(2)} on register ${session.registerNo}`,
    );
    return sale;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
