import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Category, CategoryPayload } from './category.model';

const API_URL = `${API_BASE_URL}/wms/categories`;

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(API_URL);
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.http.post<Category>(API_URL, payload);
  }

  update(id: string, payload: Partial<CategoryPayload>): Observable<Category> {
    return this.http.patch<Category>(`${API_URL}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }
}
