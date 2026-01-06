import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class FactonetService {
  private apiUrl = environment.BASE_URL_FACTONET;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getInvoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/invoices`, { headers: this.getHeaders() });
  }

  getContracts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/contracts`, { headers: this.getHeaders() });
  }

  sweepInvoices(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/invoices/sweep`, {}, { headers: this.getHeaders() });
  }

  updateContractStatus(contractId: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/contracts/${contractId}/status`, 
      { status }, 
      { headers: this.getHeaders() }
    );
  }
}