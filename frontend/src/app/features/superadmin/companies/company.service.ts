import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { Credentials } from '../../../core/auth/auth.model';
import {
  Company,
  CompanyDetail,
  CompanyProfilePayload,
  CompanyStatus,
  CreateCompanyPayload,
  PaymentPayload,
} from './company.model';

const API_URL = `${API_BASE_URL}/superadmin/companies`;

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  list(): Observable<Company[]> {
    return this.http.get<Company[]>(API_URL);
  }

  get(id: string): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(`${API_URL}/${id}`);
  }

  create(payload: CreateCompanyPayload): Observable<{ company: CompanyDetail; credentials: Credentials }> {
    return this.http.post<{ company: CompanyDetail; credentials: Credentials }>(API_URL, payload);
  }

  update(
    id: string,
    payload: Partial<CompanyProfilePayload> & { status?: CompanyStatus },
  ): Observable<CompanyDetail> {
    return this.http.patch<CompanyDetail>(`${API_URL}/${id}`, payload);
  }

  addPayment(id: string, payload: PaymentPayload): Observable<CompanyDetail> {
    return this.http.post<CompanyDetail>(`${API_URL}/${id}/payments`, payload);
  }

  removePayment(id: string, paymentId: string): Observable<CompanyDetail> {
    return this.http.delete<CompanyDetail>(`${API_URL}/${id}/payments/${paymentId}`);
  }

  resetAdminPassword(id: string): Observable<Credentials> {
    return this.http.post<Credentials>(`${API_URL}/${id}/reset-admin-password`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }
}
