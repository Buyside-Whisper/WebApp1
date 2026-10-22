import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { CreateReceiptFromRsDto, SaveReceiptDto } from './dto/receipt.dto.js';
import { ReceiptsService, ReceiptView, RsReceiptLink } from './receipts.service.js';

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

  @Get('rs-links')
  @Roles(...ADMIN_ROLES)
  rsLinks(@CurrentUser() user: AuthUser): Promise<RsReceiptLink[]> {
    return this.receiptsService.rsLinks(user);
  }

  @Post('from-rs/:waybillId')
  @Roles(UserRole.MODULE_ADMIN)
  createFromRs(
    @CurrentUser() user: AuthUser,
    @Param('waybillId', new ParseIntPipe()) waybillId: number,
    @Body() dto: CreateReceiptFromRsDto,
  ): Promise<ReceiptView> {
    return this.receiptsService.createFromRs(user, String(waybillId), dto);
  }

  @Post('from-rs/:waybillId/reject')
  @Roles(UserRole.MODULE_ADMIN)
  rejectRs(@CurrentUser() user: AuthUser, @Param('waybillId', new ParseIntPipe()) waybillId: number): Promise<void> {
    return this.receiptsService.rejectRs(user, String(waybillId));
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
