import { Controller, Get, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user.js';
import { Access, CurrentUser } from '../../auth/decorators.js';
import { AppModuleName } from '../../companies/app-module.enum.js';
import { StockMovement } from './stock-movement.entity.js';
import { StockService, WarehouseStockRow } from './stock.service.js';

// Read-only for now: stock changes through documents (receipts, transfers, …), which come next.
// Who may see what is checked in the service (managers: only their own warehouses).
@Controller('stock')
@Access(AppModuleName.WMS)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // GET /wms/stock?warehouseId=… : the products in a warehouse.
  @Get()
  warehouseStock(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId', ParseUUIDPipe) warehouseId: string,
  ): Promise<WarehouseStockRow[]> {
    return this.stockService.warehouseStock(user, warehouseId);
  }

  // GET /wms/stock/movements?productId=… or ?warehouseId=… : newest first.
  @Get('movements')
  movements(
    @CurrentUser() user: AuthUser,
    @Query('productId', new ParseUUIDPipe({ optional: true })) productId?: string,
    @Query('warehouseId', new ParseUUIDPipe({ optional: true })) warehouseId?: string,
  ): Promise<StockMovement[]> {
    return this.stockService.movements(user, { productId, warehouseId });
  }
}
