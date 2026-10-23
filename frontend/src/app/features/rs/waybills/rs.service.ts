import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import {
  RsConnection,
  RsReceiptLink,
  RsTransferLink,
  RsWarehouseChoice,
  RsWaybillDetail,
  RsWaybillList,
} from './rs.model';

const API_URL = `${API_BASE_URL}/rs/waybills`;
const RECEIPTS_URL = `${API_BASE_URL}/wms/receipts`;

@Injectable({
  providedIn: 'root',
})
export class RsService {
  private readonly http = inject(HttpClient);

  connection(): Observable<RsConnection> {
    return this.http.get<RsConnection>(`${API_URL}/connection`);
  }

  saveConnection(username: string, password: string): Observable<RsConnection> {
    return this.http.put<RsConnection>(`${API_URL}/connection`, { username, password });
  }

  checkConnection(): Observable<RsConnection> {
    return this.http.post<RsConnection>(`${API_URL}/connection/check`, {});
  }

  disconnect(): Observable<void> {
    return this.http.delete<void>(`${API_URL}/connection`);
  }

  received(from: string, to: string, refresh = false): Observable<RsWaybillList> {
    return this.http.get<RsWaybillList>(`${API_URL}/received`, {
      params: { from, to, ...(refresh ? { refresh: 'true' } : {}) },
    });
  }

  waybill(id: string): Observable<RsWaybillDetail> {
    return this.http.get<RsWaybillDetail>(`${API_URL}/${id}`);
  }

  receiptLinks(): Observable<RsReceiptLink[]> {
    return this.http.get<RsReceiptLink[]>(`${RECEIPTS_URL}/rs-links`);
  }

  transferLinks(): Observable<RsTransferLink[]> {
    return this.http.get<RsTransferLink[]>(`${API_BASE_URL}/wms/transfers/rs-links`);
  }

  createTransfer(waybillId: string, fromWarehouseId: string, toWarehouseId: string): Observable<{ id: string; code: string }> {
    return this.http.post<{ id: string; code: string }>(`${API_BASE_URL}/wms/transfers/from-rs/${waybillId}`, {
      fromWarehouseId,
      toWarehouseId,
    });
  }

  warehouses(): Observable<RsWarehouseChoice[]> {
    return this.http.get<RsWarehouseChoice[]>(`${API_BASE_URL}/wms/warehouses/options`);
  }

  createReceipt(waybillId: string, warehouseId: string): Observable<{ id: string; code: string }> {
    return this.http.post<{ id: string; code: string }>(`${RECEIPTS_URL}/from-rs/${waybillId}`, { warehouseId });
  }

  reject(waybillId: string): Observable<void> {
    return this.http.post<void>(`${RECEIPTS_URL}/from-rs/${waybillId}/reject`, {});
  }
}
