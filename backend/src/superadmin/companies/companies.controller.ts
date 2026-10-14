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
import { CompaniesService, CompanyView } from './companies.service.js';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto.js';

@Controller('companies')
@Roles(UserRole.SUPERUSER)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(): Promise<CompanyView[]> {
    return this.companiesService.findAll();
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyDto,
  ): Promise<{ company: CompanyView; credentials: Credentials }> {
    return this.companiesService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyView> {
    return this.companiesService.update(user, id, dto);
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
