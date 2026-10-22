import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RsWaybillsModule } from '../../rs/waybills/waybills.module.js';
import { StockModule } from '../stock/stock.module.js';
import { Transfer } from './transfer.entity.js';
import { TransferLine } from './transfer-line.entity.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transfer, TransferLine]), StockModule, RsWaybillsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
