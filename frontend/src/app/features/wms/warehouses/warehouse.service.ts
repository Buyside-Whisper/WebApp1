import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { ImportSource } from '../../../shared/xlsx-import/xlsx-import.model';
import {
  ManagerOption,
  Warehouse,
  WarehouseImportReport,
  WarehouseOption,
  WarehousePayload,
  WarehousePreviewRow,
} from './warehouse.model';

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

  readonly importSource: ImportSource<WarehousePreviewRow> = {
    template: () => this.http.get(`${API_URL}/import/template`, { responseType: 'blob' }),
    check: (file) => this.http.post<WarehouseImportReport>(`${API_URL}/import/check`, this.fileForm(file)),
    import: (file) => this.http.post<WarehouseImportReport>(`${API_URL}/import`, this.fileForm(file)),
  };

  export(): Observable<Blob> {
    return this.http.get(`${API_URL}/export`, { responseType: 'blob' });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  private fileForm(file: File): FormData {
    const form = new FormData();
    form.append('file', file);
    return form;
  }
}
