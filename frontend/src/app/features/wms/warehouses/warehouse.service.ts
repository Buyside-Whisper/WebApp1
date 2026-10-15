import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { ManagerOption, Warehouse, WarehouseOption, WarehousePayload } from './warehouse.model';

const API_URL = `${API_BASE_URL}/wms/warehouses`;

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  private readonly http = inject(HttpClient);

  list(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(API_URL);
  }

  get(id: string): Observable<Warehouse> {
    return this.http.get<Warehouse>(`${API_URL}/${id}`);
  }

  options(): Observable<WarehouseOption[]> {
    return this.http.get<WarehouseOption[]>(`${API_URL}/options`);
  }

  managerOptions(): Observable<ManagerOption[]> {
    return this.http.get<ManagerOption[]>(`${API_URL}/manager-options`);
  }

  create(payload: WarehousePayload): Observable<Warehouse> {
    return this.http.post<Warehouse>(API_URL, payload);
  }

  update(id: string, payload: Partial<WarehousePayload>): Observable<Warehouse> {
    return this.http.patch<Warehouse>(`${API_URL}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }
}
