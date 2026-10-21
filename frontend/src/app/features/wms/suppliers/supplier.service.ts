import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Supplier, SupplierPayload } from './supplier.model';

const API_URL = `${API_BASE_URL}/wms/suppliers`;

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private readonly http = inject(HttpClient);

  list(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(API_URL);
  }

  create(payload: SupplierPayload): Observable<Supplier> {
    return this.http.post<Supplier>(API_URL, payload);
  }

  update(id: string, payload: Partial<SupplierPayload>): Observable<Supplier> {
    return this.http.patch<Supplier>(`${API_URL}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }
}
