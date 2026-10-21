import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { ProductOption, ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './product.entity.js';

@Controller('products')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Product[]> {
    return this.productsService.findAll(user);
  }

  @Get('options')
  @Roles(...ADMIN_ROLES, UserRole.MANAGER)
  options(@CurrentUser() user: AuthUser): Promise<ProductOption[]> {
    return this.productsService.options(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(user, id);
  }

  @Post()
  @Roles(UserRole.MODULE_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MODULE_ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto): Promise<Product> {
    return this.productsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MODULE_ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.productsService.remove(user, id);
  }
}
