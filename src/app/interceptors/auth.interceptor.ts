import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../shared/services/auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  let tenantId: string | null = null;

  if (typeof window !== 'undefined') {
    tenantId = sessionStorage.getItem('user_id');
  }

  let authReq = req;

  if (token) {
    authReq = authReq.clone({
      headers: authReq.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  if (tenantId) {
    authReq = authReq.clone({
      headers: authReq.headers.set('x-tenant-id', tenantId)
    });
  }

  return next(authReq);
};