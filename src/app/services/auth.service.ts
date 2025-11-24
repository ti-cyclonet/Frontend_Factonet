import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = environment.BASE_URL_AUTHORIZA;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Verificar si hay un token guardado al inicializar
    const token = localStorage.getItem('token');
    if (token) {
      this.validateStoredToken();
    }
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.authUrl}/api/auth/login`, credentials);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  saveToken(token: string): void {
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  setCurrentUser(user: any): void {
    localStorage.setItem('user', JSON.stringify(user));
    
    // Guardar en sessionStorage igual que Authoriza
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user_id', user.id || '');
      sessionStorage.setItem('user_email', user.email || '');
      sessionStorage.setItem('user_name', user.name || '');
      sessionStorage.setItem('user_rol', user.rol || '');
      sessionStorage.setItem('user_rolDescription', user.rolDescription || '');
      sessionStorage.setItem('user_image', user.image || '');
      
      // Campos adicionales igual que Authoriza
      if (user.firstName) sessionStorage.setItem('user_firstName', user.firstName);
      if (user.secondName) sessionStorage.setItem('user_secondName', user.secondName);
      if (user.businessName) sessionStorage.setItem('user_businessName', user.businessName);
    }
    
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  private validateStoredToken(): void {
    const token = this.getToken();
    if (token) {
      // Validar token con el backend de Authoriza
      this.http.get(`${this.authUrl}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: (user) => {
          this.setCurrentUser(user);
        },
        error: () => {
          this.logout();
        }
      });
    }
  }
}