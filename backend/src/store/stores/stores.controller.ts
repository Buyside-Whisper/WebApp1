import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto.js';
import { PersonRef, StoresService, StoreView } from './stores.service.js';

@Controller('stores')
@Access(AppModuleName.STORE)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<StoreView[]> {
    return this.storesService.findAll(user);
  }

  @Get('options')
  @Roles(UserRole.MODULE_ADMIN)
  options(@CurrentUser() user: AuthUser): Promise<{ managers: PersonRef[] }> {
    return this.storesService.options(user);
  }

  @Post()
  @Roles(UserRole.MODULE_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto): Promise<StoreView> {
    return this.storesService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MODULE_ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStoreDto): Promise<StoreView> {
    return this.storesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MODULE_ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.storesService.remove(user, id);
  }
}
