import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AccAccount { id: string; code: string; name: string; nature: 'DEBITO' | 'CREDITO'; level: number; parentCode: string | null; acceptsEntries: boolean; requiresThirdParty: boolean; active: boolean }
export interface AccThirdParty { id: string; idType: string; idNumber: string; name: string; email: string | null }
export interface AccLine { id?: string; accountCode: string; thirdPartyId?: string | null; description?: string | null; debit: number; credit: number }
export interface AccVoucher {
  id: string; type: 'CI' | 'CE' | 'NC' | 'AUT'; number: number; date: string; description: string;
  status: 'BORRADOR' | 'CONTABILIZADO' | 'ANULADO'; total: number; sourceKey: string | null; reversalOfId: string | null; lines?: AccLine[];
}
export interface InboxDoc {
  id: string; source: 'CORREO' | 'CARGA'; fromAddress: string | null; subject: string | null;
  status: 'PENDIENTE' | 'CONTABILIZADA' | 'DUPLICADA' | 'RECHAZADA' | 'SIN_XML' | 'ERROR' | 'DESCARTADA';
  kind: 'Invoice' | 'CreditNote' | null; cufe: string | null; supplierNit: string | null; supplierName: string | null;
  number: string | null; issueDate: string | null; dueDate: string | null; base: number; iva: number; otherTaxes: number; payable: number;
  data: { lines?: { description: string; quantity: number; amount: number }[]; withholdings?: { renta: number; iva: number; ica: number }; references?: string[] } | null;
  message: string | null; accountCode: string | null; voucherId: string | null; pdfName: string | null; receivedAt: string; reviewedBy: string | null;
}
export interface BalanceRow { code: string; name: string; level: number; nature: string; opening: number; debit: number; credit: number; closing: number }

/** Contabilidad de CycloNet (backend de FactoNet, solo adminFactonet). */
@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly base = `${environment.BASE_URL_FACTONET}/accounting`;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('authToken') || sessionStorage.getItem('token') || localStorage.getItem('authToken')}` });
  }

  private get<T>(path: string, params: Record<string, string> = {}): Observable<T> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    return this.http.get<T>(`${this.base}${path}`, { headers: this.headers, params: clean });
  }

  private post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body, { headers: this.headers });
  }

  status() { return this.get<{ enabled: boolean; message?: string; company?: { name: string; nit: string | null; autoFrom: string | null; accountMap?: Record<string, string> } }>('/status'); }
  sync() { return this.post<{ invoices: number; created: number; skipped: string[] }>('/sync'); }

  accounts() { return this.get<AccAccount[]>('/accounts'); }
  createAccount(b: { code: string; name: string; requiresThirdParty?: boolean }) { return this.post<AccAccount>('/accounts', b); }

  thirdParties(q = '') { return this.get<AccThirdParty[]>('/third-parties', { q }); }
  saveThirdParty(b: Partial<AccThirdParty>) { return this.post<AccThirdParty>('/third-parties', b); }

  vouchers(f: { from?: string; to?: string; type?: string; status?: string; q?: string }) { return this.get<AccVoucher[]>('/vouchers', f as any); }
  voucher(id: string) { return this.get<AccVoucher>(`/vouchers/${id}`); }
  createVoucher(b: { type: string; date: string; description: string; lines: AccLine[]; post: boolean }) { return this.post<AccVoucher>('/vouchers', b); }
  postVoucher(id: string) { return this.post<AccVoucher>(`/vouchers/${id}/post`); }
  reverse(id: string, reason: string) { return this.post<AccVoucher>(`/vouchers/${id}/reverse`, { reason }); }
  deleteDraft(id: string) { return this.http.delete(`${this.base}/vouchers/${id}`, { headers: this.headers }); }

  periods() { return this.get<{ month: string; status: string; closedBy: string | null; closedAt: string | null }[]>('/periods'); }
  closePeriod(month: string) { return this.post(`/periods/${month}/close`); }
  reopenPeriod(month: string) { return this.post(`/periods/${month}/reopen`); }

  trialBalance(from: string, to: string) { return this.get<{ rows: BalanceRow[]; totals: { debit: number; credit: number } }>('/reports/trial-balance', { from, to }); }
  incomeStatement(from: string, to: string) { return this.get<any>('/reports/income-statement', { from, to }); }
  balanceSheet(to: string) { return this.get<any>('/reports/balance-sheet', { to }); }
  ledger(account: string, from: string, to: string) { return this.get<any>('/reports/ledger', { account, from, to }); }

  // Facturas recibidas de proveedores
  inboxConfig() { return this.get<{ address: string | null; mailbox: boolean }>('/inbox/config'); }
  inbox(status = '') { return this.get<InboxDoc[]>('/inbox', { status }); }
  inboxDoc(id: string) { return this.get<InboxDoc & { preview: { lines: AccLine[]; total: number; warning: string | null } | null }>(`/inbox/${id}`); }
  inboxPoll() { return this.post<{ configured: boolean; emails: number; documents: number }>('/inbox/poll'); }
  inboxUpload(files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    return this.http.post<{ id: string; status: string; number: string | null; supplierName: string | null; message: string | null }[]>(`${this.base}/inbox/upload`, form, { headers: this.headers });
  }
  inboxPdf(id: string) { return this.http.get(`${this.base}/inbox/${id}/pdf`, { headers: this.headers, responseType: 'blob' }); }
  inboxApprove(id: string, b: { accountCode: string; saveRule: boolean; date?: string }) { return this.post<{ voucher: AccVoucher }>(`/inbox/${id}/approve`, b); }
  inboxDiscard(id: string, reason: string) { return this.post(`/inbox/${id}/discard`, { reason }); }
  inboxReopen(id: string) { return this.post(`/inbox/${id}/reopen`); }
}
