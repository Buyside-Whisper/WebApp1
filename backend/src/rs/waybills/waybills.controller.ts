import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser, Roles } from '../../auth/decorators.js';
import { ADMIN_ROLES, UserRole } from '../../auth/user-role.enum.js';
import { RsWaybillDetail } from './rs-client.js';
import { RsConnectionView, RsWaybillList, RsWaybillsService } from './waybills.service.js';
import { RsPeriodQueryDto, SaveRsConnectionDto } from './dto/rs.dto.js';

@Controller('waybills')
@Access('rs')
@Roles(...ADMIN_ROLES)
export class RsWaybillsController {
  constructor(private readonly rsService: RsWaybillsService) {}

  @Get('connection')
  connection(@CurrentUser() user: AuthUser): Promise<RsConnectionView> {
    return this.rsService.connection(user);
  }

  @Put('connection')
  @Roles(UserRole.SYSTEM_ADMIN)
  saveConnection(@CurrentUser() user: AuthUser, @Body() dto: SaveRsConnectionDto): Promise<RsConnectionView> {
    return this.rsService.saveConnection(user, dto);
  }

  @Post('connection/check')
  check(@CurrentUser() user: AuthUser): Promise<RsConnectionView> {
    return this.rsService.check(user);
  }

  @Delete('connection')
  @Roles(UserRole.SYSTEM_ADMIN)
  disconnect(@CurrentUser() user: AuthUser): Promise<void> {
    return this.rsService.disconnect(user);
  }

  @Get('received')
  received(@CurrentUser() user: AuthUser, @Query() query: RsPeriodQueryDto): Promise<RsWaybillList> {
    return this.rsService.receivedWaybills(user, query);
  }

  @Get(':id')
  waybill(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RsWaybillDetail> {
    return this.rsService.waybill(user, id);
  }
}
