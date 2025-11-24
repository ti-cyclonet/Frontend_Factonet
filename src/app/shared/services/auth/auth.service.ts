import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../../environment/environment';
import { UserDataService } from '../user/user-data.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.BASE_URL_AUTHORIZA}/api/auth/login`;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private userDataService: UserDataService
  ) {}

  login(credentials: { email: string; password: string; applicationName: string }): Observable<any> {
    return this.http.post<any>(
      this.apiUrl,
      credentials      
    ).pipe(
      tap(response => {        
        if (isPlatformBrowser(this.platformId)) {
          this.setUserSession(response);
        }
      })
    );
  }

  setUserSession(userData: any): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('=== DATOS COMPLETOS DEL BACKEND ===');
      console.log('userData completo:', JSON.stringify(userData, null, 2));
      console.log('userData.user:', userData.user);
      console.log('userData.user.name:', userData.user?.name);
      console.log('userData.user.email:', userData.user?.email);
      
      sessionStorage.setItem('token', userData.access_token);
      sessionStorage.setItem('authToken', userData.access_token);
      sessionStorage.setItem('user_id', userData.user?.id || '');
      sessionStorage.setItem('user_email', userData.user?.email || '');
      sessionStorage.setItem('user_name', userData.user?.name || '');
      sessionStorage.setItem('user_rol', userData.user?.rol || '');
      sessionStorage.setItem('user_rolDescription', userData.user?.rolDescription || '');
      sessionStorage.setItem('user_image', userData.user?.image || '');
      
      // Campos adicionales igual que Authoriza
      if (userData.user?.firstName) sessionStorage.setItem('user_firstName', userData.user.firstName);
      if (userData.user?.secondName) sessionStorage.setItem('user_secondName', userData.user.secondName);
      if (userData.user?.businessName) sessionStorage.setItem('user_businessName', userData.user.businessName);
      
      console.log('=== DATOS GUARDADOS EN SESSIONSTORAGE ===');
      console.log('user_name guardado:', sessionStorage.getItem('user_name'));
      console.log('user_firstName guardado:', sessionStorage.getItem('user_firstName'));
      console.log('user_secondName guardado:', sessionStorage.getItem('user_secondName'));
      console.log('user_businessName guardado:', sessionStorage.getItem('user_businessName'));
      console.log('user_email guardado:', sessionStorage.getItem('user_email'));
      console.log('user_rol guardado:', sessionStorage.getItem('user_rol'));
      
      // Actualizar el servicio de datos del usuario
      this.userDataService.updateUserData({
        id: userData.user?.id || '',
        name: userData.user?.name || '',
        email: userData.user?.email || '',
        rol: userData.user?.rol || '',
        rolDescription: userData.user?.rolDescription || userData.user?.rol || '',
        image: userData.user?.image
      });
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      // Limpiar localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      
      // Limpiar sessionStorage completamente
      sessionStorage.clear();
      
      // Limpiar datos del usuario en el servicio
      this.userDataService.clearUserData();
      
      // Redirigir al login
      this.router.navigate(['/login']);
    }
  }

  isAuthenticated(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!sessionStorage.getItem('authToken');
    }
    return false;
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return sessionStorage.getItem('authToken');
    }
    return null;
  }
}
