import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { SaveReceiptDto } from './dto/receipt.dto.js';
import { ReceiptsService, ReceiptView } from './receipts.service.js';

// Admins and WMS managers read; the WMS admin and managers (their own warehouses, checked in the
// service) create, post and cancel. The system admin only reads.
const WRITERS = [UserRole.MODULE_ADMIN, UserRole.MANAGER];

@Controller('receipts')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES, UserRole.MANAGER)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<ReceiptView[]> {
    return this.receiptsService.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReceiptView> {
    return this.receiptsService.findOne(user, id);
  }

  @Post()
  @Roles(...WRITERS)
  create(@CurrentUser() user: AuthUser, @Body() dto: SaveReceiptDto): Promise<ReceiptView> {
    return this.receiptsService.create(user, dto);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveReceiptDto,
  ): Promise<ReceiptView> {
    return this.receiptsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...WRITERS)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.receiptsService.remove(user, id);
  }

  @Post(':id/post')
  @Roles(...WRITERS)
  post(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReceiptView> {
    return this.receiptsService.post(user, id);
  }

  @Post(':id/cancel')
  @Roles(...WRITERS)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReceiptView> {
    return this.receiptsService.cancel(user, id);
  }
}
