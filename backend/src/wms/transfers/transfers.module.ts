import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockModule } from '../stock/stock.module.js';
import { Transfer } from './transfer.entity.js';
import { TransferLine } from './transfer-line.entity.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transfer, TransferLine]), StockModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
