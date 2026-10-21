import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Transfer, TransferPayload } from './transfer.model';

const API_URL = `${API_BASE_URL}/wms/transfers`;

@Injectable({
  providedIn: 'root',
})
export class TransferService {
  private readonly http = inject(HttpClient);

  list(): Observable<Transfer[]> {
    return this.http.get<Transfer[]>(API_URL);
  }

  get(id: string): Observable<Transfer> {
    return this.http.get<Transfer>(`${API_URL}/${id}`);
  }

  create(payload: TransferPayload): Observable<Transfer> {
    return this.http.post<Transfer>(API_URL, payload);
  }

  update(id: string, payload: TransferPayload): Observable<Transfer> {
    return this.http.patch<Transfer>(`${API_URL}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  send(id: string): Observable<Transfer> {
    return this.http.post<Transfer>(`${API_URL}/${id}/send`, {});
  }

  receive(id: string, lines: { lineId: string; receivedQuantity: number }[]): Observable<Transfer> {
    return this.http.post<Transfer>(`${API_URL}/${id}/receive`, { lines });
  }

  cancel(id: string): Observable<Transfer> {
    return this.http.post<Transfer>(`${API_URL}/${id}/cancel`, {});
  }
}
