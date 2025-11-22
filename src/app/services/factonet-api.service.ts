import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class FactonetApiService {
  private baseUrl = environment.BASE_URL_FACTONET;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Métodos de autenticación
  validateToken(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/validate`, { headers: this.getHeaders() });
  }

  getUserProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/profile`, { headers: this.getHeaders() });
  }

  getUsers(page = 1, limit = 10): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/users?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  getApplications(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/applications`, { headers: this.getHeaders() });
  }

  // Métodos para facturas
  getInvoices(page = 1, limit = 10): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/invoices?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  createInvoice(invoice: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/invoices`, invoice, { headers: this.getHeaders() });
  }

  updateInvoice(id: string, invoice: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/api/invoices/${id}`, invoice, { headers: this.getHeaders() });
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/invoices/${id}`, { headers: this.getHeaders() });
  }

  // Métodos para clientes
  getCustomers(page = 1, limit = 10): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/customers?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  createCustomer(customer: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/customers`, customer, { headers: this.getHeaders() });
  }

  // Métodos para productos
  getProducts(page = 1, limit = 10): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/products?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  createProduct(product: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/products`, product, { headers: this.getHeaders() });
  }
}