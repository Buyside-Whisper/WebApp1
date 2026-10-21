import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Sale } from '../cash-register/cash-register.model';
import { StoreProduct } from './pos.model';

const API_URL = `${API_BASE_URL}/store/pos`;

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);

  products(): Observable<StoreProduct[]> {
    return this.http.get<StoreProduct[]>(`${API_URL}/products`);
  }

  createSale(items: { productId: string; quantity: number }[]): Observable<Sale> {
    return this.http.post<Sale>(`${API_URL}/sales`, { items });
  }
}
