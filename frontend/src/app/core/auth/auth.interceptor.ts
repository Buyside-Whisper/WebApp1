import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api';
import { I18nService } from '../i18n/i18n.service';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const language = inject(I18nService).language();
  const token = auth.token();

  if (!request.url.startsWith(API_BASE_URL)) {
    return next(request);
  }
  if (!token) {
    return next(request.clone({ setHeaders: { 'Accept-Language': language } }));
  }

  return next(
    request.clone({ setHeaders: { Authorization: `Bearer ${token}`, 'Accept-Language': language } }),
  ).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
