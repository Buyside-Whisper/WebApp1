import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { CreateTransferFromRsDto, ReceiveTransferDto, SaveTransferDto } from './dto/transfer.dto.js';
import { RsTransferLink, TransfersService, TransferView } from './transfers.service.js';

const WRITERS = [UserRole.MODULE_ADMIN, UserRole.MANAGER];

@Controller('transfers')
@Access(AppModuleName.WMS)
@Roles(...ADMIN_ROLES, UserRole.MANAGER)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<TransferView[]> {
    return this.transfersService.findAll(user);
  }

  @Get('rs-links')
  @Roles(...ADMIN_ROLES)
  rsLinks(@CurrentUser() user: AuthUser): Promise<RsTransferLink[]> {
    return this.transfersService.rsLinks(user);
  }

  @Post('from-rs/:waybillId')
  @Roles(UserRole.MODULE_ADMIN)
  createFromRs(
    @CurrentUser() user: AuthUser,
    @Param('waybillId', new ParseIntPipe()) waybillId: number,
    @Body() dto: CreateTransferFromRsDto,
  ): Promise<TransferView> {
    return this.transfersService.createFromRs(user, String(waybillId), dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransferView> {
    return this.transfersService.findOne(user, id);
  }

  @Post()
  @Roles(...WRITERS)
  create(@CurrentUser() user: AuthUser, @Body() dto: SaveTransferDto): Promise<TransferView> {
    return this.transfersService.create(user, dto);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveTransferDto,
  ): Promise<TransferView> {
    return this.transfersService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...WRITERS)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transfersService.remove(user, id);
  }

  @Post(':id/send')
  @Roles(...WRITERS)
  send(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransferView> {
    return this.transfersService.send(user, id);
  }

  @Post(':id/receive')
  @Roles(...WRITERS)
  receive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
  ): Promise<TransferView> {
    return this.transfersService.receive(user, id, dto);
  }

  @Post(':id/cancel')
  @Roles(...WRITERS)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransferView> {
    return this.transfersService.cancel(user, id);
  }
}
