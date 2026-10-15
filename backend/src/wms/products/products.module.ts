import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module.js';
import { Product } from './product.entity.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), StockModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
