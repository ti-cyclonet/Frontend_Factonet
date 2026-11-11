import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { Contract } from '../model/contract.model';
import { contractPdfBase64 } from '../utils/contract-document';
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

  /**
   * Si el contrato aún no tiene PDF, lo genera y lo sube (Authoriza lo marca
   * como emitido). Lo usa el cliente al firmar: no espera a que CycloNet lo
   * prepare. Idempotente.
   */
  async ensurePdf(contract: Contract): Promise<void> {
    if (contract.pdfUrl) return;
    const { pdfUrl } = await firstValueFrom(this.uploadContractPDF(contract.id, contractPdfBase64(contract)));
    contract.pdfUrl = pdfUrl;
  }
}
