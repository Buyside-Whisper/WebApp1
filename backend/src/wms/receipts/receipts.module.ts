import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RsWaybillsModule } from '../../rs/waybills/waybills.module.js';
import { StockModule } from '../stock/stock.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { Receipt } from './receipt.entity.js';
import { ReceiptLine } from './receipt-line.entity.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';
import { RsProductLink } from '../stock/rs-product-link.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Receipt, ReceiptLine, RsProductLink]), StockModule, SuppliersModule, RsWaybillsModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}
