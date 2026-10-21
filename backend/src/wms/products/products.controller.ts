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
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { XLSX_TYPE, XLSX_UPLOAD } from '../../common/xlsx.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { ProductExcelService, ProductImportReport } from './product-excel.service.js';
import { ProductOption, ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './product.entity.js';

@Controller('products')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly excelService: ProductExcelService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Product[]> {
    return this.productsService.findAll(user);
  }

  @Get('options')
  @Roles(...ADMIN_ROLES, UserRole.MANAGER)
  options(@CurrentUser() user: AuthUser): Promise<ProductOption[]> {
    return this.productsService.options(user);
  }

  @Get('export')
  async export(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    return new StreamableFile(await this.excelService.export(user), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="products.xlsx"',
    });
  }

  @Get('import/template')
  @Roles(UserRole.MODULE_ADMIN)
  async importTemplate(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    return new StreamableFile(await this.excelService.template(user), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="products-template.xlsx"',
    });
  }

  @Post('import/check')
  @Roles(UserRole.MODULE_ADMIN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
  checkImport(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ProductImportReport> {
    return this.excelService.check(user, file);
  }

  @Post('import')
  @Roles(UserRole.MODULE_ADMIN)
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
  import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ProductImportReport> {
    return this.excelService.import(user, file);
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
