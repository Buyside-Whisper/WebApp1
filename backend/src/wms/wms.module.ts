import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { ProductsModule } from './products/products.module.js';
import { StockModule } from './stock/stock.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { TransfersModule } from './transfers/transfers.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';

@Module({
  imports: [
    WarehousesModule,
    ProductsModule,
    StockModule,
    ReceiptsModule,
    TransfersModule,
    CategoriesModule,
    SuppliersModule,
    RouterModule.register([
      {
        path: 'wms',
        children: [
          WarehousesModule,
          ProductsModule,
          StockModule,
          ReceiptsModule,
          TransfersModule,
          CategoriesModule,
          SuppliersModule,
        ],
      },
    ]),
  ],
})
export class WmsModule {}
