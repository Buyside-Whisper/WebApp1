import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { RsWaybillsModule } from './waybills/waybills.module.js';

@Module({
  imports: [
    RsWaybillsModule,
    RouterModule.register([{ path: 'rs', children: [RsWaybillsModule] }]),
  ],
})
export class RsModule {}
