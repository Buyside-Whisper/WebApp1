import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../hr/employees/employee.entity.js';
import { ProductWarehouse } from '../stock/product-warehouse.entity.js';
import { StockModule } from '../stock/stock.module.js';
import { Warehouse } from './warehouse.entity.js';
import { WarehousesService } from './warehouses.service.js';
import { WarehouseExcelService } from './warehouse-excel.service.js';
import { WarehousesController } from './warehouses.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Warehouse, Employee, ProductWarehouse]), StockModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, WarehouseExcelService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
