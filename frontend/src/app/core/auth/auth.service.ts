import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api';
import { Session, SessionUser } from './auth.model';

const STORAGE_KEY = 'webapp1.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(loadSession());

  readonly user = computed<SessionUser | null>(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);

  login(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(`${API_BASE_URL}/auth/login`, { username, password })
      .pipe(tap((session) => this.setSession(session)));
  }

  superadminLogin(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>(`${API_BASE_URL}/auth/superadmin-login`, { username, password })
      .pipe(tap((session) => this.setSession(session)));
  }

  logout(): void {
    const wasSuperuser = this.user()?.role === 'superuser';
    this.setSession(null);
    void this.router.navigateByUrl(wasSuperuser ? '/superadmin/login' : '/login');
  }

  private setSession(session: Session | null): void {
    this.session.set(session);
    try {
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
    }
  }
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
