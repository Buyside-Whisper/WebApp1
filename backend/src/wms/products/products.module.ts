import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module.js';
import { Category } from '../categories/category.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { Product } from './product.entity.js';
import { ProductsService } from './products.service.js';
import { ProductExcelService } from './product-excel.service.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, Supplier]), StockModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductExcelService],
  exports: [ProductsService],
})
export class ProductsModule {}
