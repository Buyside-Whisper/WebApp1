import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/user.entity.js';
import { Company } from '../../companies/company.entity.js';
import { Employee } from '../../hr/employees/employee.entity.js';
import { PosModule } from '../../store/pos/pos.module.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { CompanyPayment } from './company-payment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Company, User, Employee, CompanyPayment]), PosModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
