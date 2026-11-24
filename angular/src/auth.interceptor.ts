import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { PASSWORD_CHANGE_REQUIRED } from './auth.models';
import { KcAuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { from } from 'rxjs';

let isRefreshing = false;

export const kcAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(KcAuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  // Don't add token to refresh/login requests
  const isAuthRequest = req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/reset-password');

  let authReq = req;
  if (token && !isAuthRequest) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && error.error?.code === PASSWORD_CHANGE_REQUIRED) {
        router.navigate([auth.changePasswordRoute]);
        return throwError(() => error);
      }
      if (error.status === 401 && !isAuthRequest && !isRefreshing) {
        isRefreshing = true;
        return from(auth.refresh()).pipe(
          switchMap((success) => {
            isRefreshing = false;
            if (success) {
              const newToken = auth.getAccessToken();
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(retryReq);
            }
            auth.logout();
            return throwError(() => error);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            auth.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
