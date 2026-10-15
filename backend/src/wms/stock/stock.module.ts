import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Warehouse } from '../warehouses/warehouse.entity.js';
import { ProductWarehouse } from './product-warehouse.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement, ProductWarehouse, Warehouse])],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
