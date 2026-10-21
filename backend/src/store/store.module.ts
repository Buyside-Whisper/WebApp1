import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CashRegisterModule } from './cash-register/cash-register.module.js';
import { PosModule } from './pos/pos.module.js';
import { StoresModule } from './stores/stores.module.js';

@Module({
  imports: [
    StoresModule,
    PosModule,
    CashRegisterModule,
    RouterModule.register([{ path: 'store', children: [StoresModule, PosModule, CashRegisterModule] }]),
  ],
})
export class StoreModule {}
