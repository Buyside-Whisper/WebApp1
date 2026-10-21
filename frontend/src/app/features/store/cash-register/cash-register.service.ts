import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { RegisterAvailability, RegisterSession, RegisterSessionDetail } from './cash-register.model';

const API_URL = `${API_BASE_URL}/store/cash-register/sessions`;

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly http = inject(HttpClient);

  list(): Observable<RegisterSession[]> {
    return this.http.get<RegisterSession[]>(API_URL);
  }

  detail(id: string): Observable<RegisterSessionDetail> {
    return this.http.get<RegisterSessionDetail>(`${API_URL}/${id}`);
  }

  current(): Observable<RegisterSession | null> {
    return this.http.get<RegisterSession | null>(`${API_URL}/current`);
  }

  registers(storeId: string): Observable<RegisterAvailability[]> {
    return this.http.get<RegisterAvailability[]>(`${API_BASE_URL}/store/cash-register/registers`, {
      params: { storeId },
    });
  }

  open(storeId: string, registerNo: number, openingCash: number): Observable<RegisterSession> {
    return this.http.post<RegisterSession>(API_URL, { storeId, registerNo, openingCash });
  }

  close(id: string, closingCash: number): Observable<RegisterSession> {
    return this.http.post<RegisterSession>(`${API_URL}/${id}/close`, { closingCash });
  }
}
