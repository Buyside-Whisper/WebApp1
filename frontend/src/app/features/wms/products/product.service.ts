import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { ImportSource } from '../../../shared/xlsx-import/xlsx-import.model';
import {
  Product,
  ProductImportReport,
  ProductOption,
  ProductPayload,
  ProductPreviewRow,
} from './product.model';

const API_URL = `${API_BASE_URL}/wms/products`;

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);

  list(): Observable<Product[]> {
    return this.http.get<Product[]>(API_URL);
  }

  options(): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`${API_URL}/options`);
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(`${API_URL}/${id}`);
  }

  create(payload: ProductPayload): Observable<Product> {
    return this.http.post<Product>(API_URL, payload);
  }

  update(id: string, payload: Partial<ProductPayload>): Observable<Product> {
    return this.http.patch<Product>(`${API_URL}/${id}`, payload);
  }

  readonly importSource: ImportSource<ProductPreviewRow> = {
    template: () => this.http.get(`${API_URL}/import/template`, { responseType: 'blob' }),
    check: (file) => this.http.post<ProductImportReport>(`${API_URL}/import/check`, this.fileForm(file)),
    import: (file) => this.http.post<ProductImportReport>(`${API_URL}/import`, this.fileForm(file)),
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
