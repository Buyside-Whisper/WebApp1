import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Receipt, ReceiptPayload } from './receipt.model';

const API_URL = `${API_BASE_URL}/wms/receipts`;

@Injectable({
  providedIn: 'root',
})
export class ReceiptService {
  private readonly http = inject(HttpClient);

  list(): Observable<Receipt[]> {
    return this.http.get<Receipt[]>(API_URL);
  }

  get(id: string): Observable<Receipt> {
    return this.http.get<Receipt>(`${API_URL}/${id}`);
  }

  create(payload: ReceiptPayload): Observable<Receipt> {
    return this.http.post<Receipt>(API_URL, payload);
  }

  update(id: string, payload: ReceiptPayload): Observable<Receipt> {
    return this.http.patch<Receipt>(`${API_URL}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  post(id: string): Observable<Receipt> {
    return this.http.post<Receipt>(`${API_URL}/${id}/post`, {});
  }

  cancel(id: string): Observable<Receipt> {
    return this.http.post<Receipt>(`${API_URL}/${id}/cancel`, {});
  }
}
