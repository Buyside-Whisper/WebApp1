import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { SuppliersService } from './suppliers.service.js';
import { Supplier } from './supplier.entity.js';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto.js';

@Controller('suppliers')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Supplier[]> {
    return this.suppliersService.findAll(user);
  }

  @Post()
  @Roles(UserRole.MODULE_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto): Promise<Supplier> {
    return this.suppliersService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MODULE_ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto): Promise<Supplier> {
    return this.suppliersService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MODULE_ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.suppliersService.remove(user, id);
  }
}
