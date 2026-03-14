import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class FactonetService {
  private apiUrl = environment.BASE_URL_FACTONET;
  private authorizaUrl = environment.BASE_URL_AUTHORIZA;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getInvoices(): Observable<any[]> {
    // Asegurar que solo obtenemos facturas, no contratos
    return this.http.get<any[]>(`${this.apiUrl}/api/invoices`, { headers: this.getHeaders() });
  }

  getContracts(): Observable<any[]> {
    // Contratos vienen de FactoNet
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

  updateInvoiceStatus(invoiceId: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/invoices/${invoiceId}/status`, 
      { status }, 
      { headers: this.getHeaders() }
    );
  }

  // Métodos de Reportes
  getManagementIndicators(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.contractId) params = params.set('contractId', filters.contractId);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/management-indicators`, 
      { headers: this.getHeaders(), params }
    );
  }

  getClientsReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/clients`, 
      { headers: this.getHeaders(), params }
    );
  }

  getContractsReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/contracts`, 
      { headers: this.getHeaders(), params }
    );
  }

  getInvoicesReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.contractId) params = params.set('contractId', filters.contractId);
    if (filters?.status) params = params.set('status', filters.status);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/invoices`, 
      { headers: this.getHeaders(), params }
    );
  }

  getProfitsReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.contractId) params = params.set('contractId', filters.contractId);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/profits`, 
      { headers: this.getHeaders(), params }
    );
  }

  getTaxesReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/taxes`, 
      { headers: this.getHeaders(), params }
    );
  }

  getGlobalParametersReport(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    
    return this.http.get<any>(`${this.apiUrl}/api/reports/global-parameters`, 
      { headers: this.getHeaders(), params }
    );
  }
}