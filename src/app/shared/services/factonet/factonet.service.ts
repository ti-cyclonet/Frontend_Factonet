import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class FactonetService {
  private apiUrl = environment.BASE_URL_FACTONET;

  constructor(private http: HttpClient) {}

  // Métodos para facturas
  getInvoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/invoices`);
  }

  getInvoiceById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/invoices/${id}`);
  }

  createInvoice(invoice: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/invoices`, invoice);
  }

  updateInvoice(id: string, invoice: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/invoices/${id}`, invoice);
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/invoices/${id}`);
  }

  // Métodos para contratos
  getContracts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/contracts`);
  }

  getContractById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/contracts/${id}`);
  }

  createContract(contract: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/contracts`, contract);
  }

  updateContract(id: string, contract: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/contracts/${id}`, contract);
  }

  deleteContract(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/contracts/${id}`);
  }
}