import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

export const AuthGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const router = inject(Router);

  // 🔹 Verifica si estamos en el navegador
  if (typeof window === 'undefined') {
    return router.createUrlTree(['/login']);
  }

  const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
  
  if (!token) {
    return router.createUrlTree(['/login']);
  }

  if (state.url === '**') {
    router.navigate(['/contracts']);
    return false;
  }
  
  return true;
};
