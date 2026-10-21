import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './category.entity.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@Controller('categories')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Category[]> {
    return this.categoriesService.findAll(user);
  }

  @Post()
  @Roles(UserRole.MODULE_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MODULE_ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<Category> {
    return this.categoriesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MODULE_ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(user, id);
  }
}
