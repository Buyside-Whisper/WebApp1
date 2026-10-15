import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module.js';
import { Receipt } from './receipt.entity.js';
import { ReceiptLine } from './receipt-line.entity.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Receipt, ReceiptLine]), StockModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}
