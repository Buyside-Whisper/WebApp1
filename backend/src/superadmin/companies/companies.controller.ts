import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser, Roles } from '../../auth/decorators.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { Credentials } from '../../auth/users.service.js';
import { CompaniesService, CompanyDetail, CompanyView } from './companies.service.js';
import { CreateCompanyDto, CreatePaymentDto, UpdateCompanyDto } from './dto/company.dto.js';

@Controller('companies')
@Roles(UserRole.SUPERUSER)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(): Promise<CompanyView[]> {
    return this.companiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CompanyDetail> {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyDto,
  ): Promise<{ company: CompanyDetail; credentials: Credentials }> {
    return this.companiesService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyDetail> {
    return this.companiesService.update(user, id, dto);
  }

  @Post(':id/payments')
  addPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<CompanyDetail> {
    return this.companiesService.addPayment(user, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  removePayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ): Promise<CompanyDetail> {
    return this.companiesService.removePayment(user, id, paymentId);
  }

  @Post(':id/reset-admin-password')
  resetAdminPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Credentials> {
    return this.companiesService.resetAdminPassword(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.companiesService.remove(user, id);
  }
}
