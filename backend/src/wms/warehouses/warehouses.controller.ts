import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { ManagerOption, WarehouseOption, WarehousesService } from './warehouses.service.js';
import { XLSX_TYPE, XLSX_UPLOAD } from '../../common/xlsx.js';
import { WarehouseExcelService, WarehouseImportReport } from './warehouse-excel.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { Warehouse } from './warehouse.entity.js';

@Controller('warehouses')
@Access(AppModuleName.WMS)
export class WarehousesController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly excelService: WarehouseExcelService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Warehouse[]> {
    return this.warehousesService.findAll(user);
  }

  @Get('options')
  options(@CurrentUser() user: AuthUser): Promise<WarehouseOption[]> {
    return this.warehousesService.options(user);
  }

  @Get('manager-options')
  @Roles(UserRole.MODULE_ADMIN)
  managerOptions(@CurrentUser() user: AuthUser): Promise<ManagerOption[]> {
    return this.warehousesService.managerOptions(user);
  }

  @Get('export')
  async export(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    return new StreamableFile(await this.excelService.export(user), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="warehouses.xlsx"',
    });
  }

  @Get('import/template')
  @Roles(UserRole.MODULE_ADMIN)
  async importTemplate(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    return new StreamableFile(await this.excelService.template(user), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="warehouses-template.xlsx"',
    });
  }

  @Post('import/check')
  @Roles(UserRole.MODULE_ADMIN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
  checkImport(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<WarehouseImportReport> {
    return this.excelService.check(user, file);
  }

  @Post('import')
  @Roles(UserRole.MODULE_ADMIN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
  import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<WarehouseImportReport> {
    return this.excelService.import(user, file);
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
