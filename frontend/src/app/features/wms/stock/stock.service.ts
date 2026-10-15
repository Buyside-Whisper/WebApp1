import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { StockMovement, WarehouseStockRow } from './stock.model';

const API_URL = `${API_BASE_URL}/wms/stock`;

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private readonly http = inject(HttpClient);

  warehouseStock(warehouseId: string): Observable<WarehouseStockRow[]> {
    return this.http.get<WarehouseStockRow[]>(API_URL, { params: { warehouseId } });
  }

  productMovements(productId: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${API_URL}/movements`, { params: { productId } });
  }

  warehouseMovements(warehouseId: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${API_URL}/movements`, { params: { warehouseId } });
  }
}
