import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {
  private baseUrl = 'http://localhost:3003/api/contracts';

  constructor(private http: HttpClient) {}

  uploadContractPDF(contractId: string, pdfBuffer: string): Observable<{ pdfUrl: string }> {
    return this.http.post<{ pdfUrl: string }>(`${this.baseUrl}/${contractId}/pdf`, {
      pdfBuffer
    });
  }
}