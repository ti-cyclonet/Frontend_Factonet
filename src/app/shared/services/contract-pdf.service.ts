import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {
  private baseUrl = `${environment.BASE_URL_FACTONET}/contracts`;

  constructor(private http: HttpClient) {}

  uploadContractPDF(contractId: string, pdfBuffer: string): Observable<{ pdfUrl: string }> {
    return this.http.post<{ pdfUrl: string }>(`${this.baseUrl}/${contractId}/pdf`, {
      pdfBuffer
    });
  }
}