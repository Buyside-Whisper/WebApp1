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
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { ManagerOption, WarehouseOption, WarehousesService } from './warehouses.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { Warehouse } from './warehouse.entity.js';

@Controller('warehouses')
@Access(AppModuleName.WMS)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Warehouse[]> {
    return this.warehousesService.findAll(user);
  }

  // All of the company's warehouses, minimal (no manager / HR data), for the pickers on receipts
  // and transfers. Managers need it too: they send goods to warehouses they don't run.
  @Get('options')
  options(@CurrentUser() user: AuthUser): Promise<WarehouseOption[]> {
    return this.warehousesService.options(user);
  }

  @Get('manager-options')
  @Roles(UserRole.MODULE_ADMIN)
  managerOptions(@CurrentUser() user: AuthUser): Promise<ManagerOption[]> {
    return this.warehousesService.managerOptions(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Warehouse> {
    return this.warehousesService.findOne(user, id);
  }

  @Post()
  @Roles(UserRole.MODULE_ADMIN)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWarehouseDto,
  ): Promise<Warehouse> {
    return this.warehousesService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MODULE_ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    return this.warehousesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MODULE_ADMIN)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.warehousesService.remove(user, id);
  }
}
