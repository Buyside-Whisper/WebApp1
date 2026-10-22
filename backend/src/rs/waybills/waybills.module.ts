import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RsClient } from './rs-client.js';
import { RsConnection } from './rs-connection.entity.js';
import { RsWaybillsController } from './waybills.controller.js';
import { RsWaybillsService } from './waybills.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([RsConnection])],
  controllers: [RsWaybillsController],
  providers: [RsWaybillsService, RsClient],
  exports: [RsWaybillsService, RsClient],
})
export class RsWaybillsModule {}
