import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../../environment/environment';

export interface DashboardMetrics {
  pendingInvoices: number;
  paidInvoices: number;
  totalContracts: number;
  activeContracts: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.BASE_URL_FACTONET;

  constructor(private http: HttpClient) {}

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.apiUrl}/api/dashboard/metrics`);
  }
}