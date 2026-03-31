import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.BASE_URL_FACTONET;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  changePassword(userId: string, oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/change-password`, {
      userId,
      oldPassword,
      newPassword
    }, { headers: this.getHeaders() });
  }
}