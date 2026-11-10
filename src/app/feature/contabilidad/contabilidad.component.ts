import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AccAccount, AccLine, AccThirdParty, AccVoucher, AccountingService, BalanceRow } from '../../shared/services/accounting.service';

type Tab = 'resumen' | 'comprobantes' | 'reportes' | 'cuentas' | 'terceros' | 'periodos';
type Report = 'resultados' | 'situacion' | 'prueba' | 'mayor';

const TIPOS: Record<string, string> = { CI: 'Ingreso', CE: 'Egreso', NC: 'Nota contable', AUT: 'Automático' };
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Contabilidad de CycloNet (etapa 1, solo adminFactonet): sincronización con
 * las facturas de Authoriza, comprobantes, reportes, plan de cuentas,
 * terceros y cierre de meses.
 */
@Component({
  selector: 'app-contabilidad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contabilidad.component.html',
  styleUrls: ['./contabilidad.component.css'],
})
export class ContabilidadComponent implements OnInit {
  tab: Tab = 'resumen';
  tipos = TIPOS;
  loading = true;
  enabled = false;
  disabledMessage = '';
  company: { name: string; nit: string | null; autoFrom: string | null } | null = null;
  busy = false;

  accounts: AccAccount[] = [];
  postable: AccAccount[] = [];
  thirdParties: AccThirdParty[] = [];

  // Resumen
  month = hoy().slice(0, 7);
  er: any = null;
  syncResult: { invoices: number; created: number; skipped: string[] } | null = null;

  // Comprobantes
  filters = { from: `${hoy().slice(0, 7)}-01`, to: hoy(), type: '', status: '', q: '' };
  vouchers: AccVoucher[] = [];
  detail: AccVoucher | null = null;
  form: { type: 'CI' | 'CE' | 'NC'; date: string; description: string; lines: AccLine[] } | null = null;

  // Reportes
  report: Report = 'resultados';
  rFrom = `${hoy().slice(0, 4)}-01-01`;
  rTo = hoy();
  rAccount = '111005';
  reportData: any = null;

  // Cuentas y terceros
  accFilter = '';
  newAccount = { code: '', name: '', requiresThirdParty: false };
  tpFilter = '';
  newTp: Partial<AccThirdParty> = { idType: '13', idNumber: '', name: '', email: '' };

  // Periodos
  periods: { month: string; status: string; closedBy: string | null; closedAt: string | null }[] = [];
  months: string[] = [];

  constructor(private api: AccountingService) {}

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => {
        this.enabled = s.enabled;
        this.disabledMessage = s.message || '';
        this.company = s.company || null;
        this.loading = false;
        if (s.enabled) {
          this.loadAccounts();
          this.loadThirdParties();
          this.loadSummary();
        }
      },
      error: (e) => {
        this.loading = false;
        this.disabledMessage = e?.error?.message || 'No se pudo consultar la contabilidad.';
      },
    });
  }

  setTab(t: Tab): void {
    this.tab = t;
    if (t === 'comprobantes') this.loadVouchers();
    if (t === 'reportes' && !this.reportData) this.runReport();
    if (t === 'periodos') this.loadPeriods();
  }

  private fail(e: any, title = 'No se pudo completar'): void {
    this.busy = false;
    const m = e?.error?.message;
    const errs: string[] = e?.error?.errors || [];
    Swal.fire({ icon: 'warning', title, html: errs.length > 1 ? `<ul style="text-align:left">${errs.map((x) => `<li>${this.esc(x)}</li>`).join('')}</ul>` : this.esc(Array.isArray(m) ? m[0] : m || 'Intenta de nuevo.') });
  }

  esc(s: string): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  }

  money(v: number | string): string {
    return '$' + new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0);
  }

  // ═══ Resumen
  loadSummary(): void {
    const from = `${this.month}-01`;
    const [y, m] = this.month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    this.api.incomeStatement(from, to).subscribe({ next: (r) => (this.er = r), error: () => (this.er = null) });
  }

  sync(): void {
    this.busy = true;
    this.api.sync().subscribe({
      next: (r) => { this.busy = false; this.syncResult = r; this.loadSummary(); this.loadThirdParties(); },
      error: (e) => this.fail(e, 'No se pudo sincronizar con Authoriza'),
    });
  }

  // ═══ Cuentas y terceros
  loadAccounts(): void {
    this.api.accounts().subscribe((a) => {
      this.accounts = a;
      this.postable = a.filter((x) => x.acceptsEntries && x.active);
    });
  }

  get filteredAccounts(): AccAccount[] {
    const f = this.accFilter.trim().toLowerCase();
    return f ? this.accounts.filter((a) => a.code.startsWith(f) || a.name.toLowerCase().includes(f)) : this.accounts;
  }

  accountName(code: string): string {
    return this.accounts.find((a) => a.code === code)?.name || '';
  }

  needsThirdParty(code: string): boolean {
    return !!this.accounts.find((a) => a.code === code)?.requiresThirdParty;
  }

  createAccount(): void {
    this.busy = true;
    this.api.createAccount(this.newAccount).subscribe({
      next: () => { this.busy = false; this.newAccount = { code: '', name: '', requiresThirdParty: false }; this.loadAccounts(); },
      error: (e) => this.fail(e, 'No se pudo crear la cuenta'),
    });
  }

  loadThirdParties(): void {
    this.api.thirdParties(this.tpFilter).subscribe((t) => (this.thirdParties = t));
  }

  thirdPartyName(id: string | null | undefined): string {
    return (id && this.thirdParties.find((t) => t.id === id)?.name) || '';
  }

  saveThirdParty(): void {
    this.busy = true;
    this.api.saveThirdParty(this.newTp).subscribe({
      next: () => { this.busy = false; this.newTp = { idType: '13', idNumber: '', name: '', email: '' }; this.loadThirdParties(); },
      error: (e) => this.fail(e, 'No se pudo guardar el tercero'),
    });
  }

  // ═══ Comprobantes
  loadVouchers(): void {
    this.api.vouchers(this.filters).subscribe({ next: (v) => (this.vouchers = v), error: (e) => this.fail(e, 'No se pudieron cargar los comprobantes') });
  }

  openVoucher(v: AccVoucher): void {
    this.api.voucher(v.id).subscribe((d) => (this.detail = d));
  }

  newVoucher(): void {
    this.detail = null;
    this.form = { type: 'NC', date: hoy(), description: '', lines: [this.emptyLine(), this.emptyLine()] };
  }

  emptyLine(): AccLine {
    return { accountCode: '', thirdPartyId: null, description: '', debit: 0, credit: 0 };
  }

  get formTotals() {
    const l = this.form?.lines || [];
    const debit = r2(l.reduce((s, x) => s + (Number(x.debit) || 0), 0));
    const credit = r2(l.reduce((s, x) => s + (Number(x.credit) || 0), 0));
    return { debit, credit, diff: r2(debit - credit) };
  }

  trackLine = (i: number) => i;

  saveVoucher(post: boolean): void {
    if (!this.form) return;
    this.busy = true;
    const lines = this.form.lines
      .filter((l) => l.accountCode && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, thirdPartyId: l.thirdPartyId || null }));
    this.api.createVoucher({ ...this.form, lines, post }).subscribe({
      next: (v) => {
        this.busy = false;
        this.form = null;
        Swal.fire({ icon: 'success', title: post ? 'Comprobante contabilizado' : 'Borrador guardado', text: `${TIPOS[v.type]} ${v.number}`, timer: 1800, showConfirmButton: false });
        this.loadVouchers();
      },
      error: (e) => this.fail(e, 'Revisa el comprobante'),
    });
  }

  postVoucher(v: AccVoucher): void {
    this.api.postVoucher(v.id).subscribe({ next: () => { this.detail = null; this.loadVouchers(); }, error: (e) => this.fail(e, 'No se pudo contabilizar') });
  }

  async deleteDraft(v: AccVoucher): Promise<void> {
    const r = await Swal.fire({ icon: 'warning', title: '¿Eliminar el borrador?', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' });
    if (!r.isConfirmed) return;
    this.api.deleteDraft(v.id).subscribe({ next: () => { this.detail = null; this.loadVouchers(); }, error: (e) => this.fail(e) });
  }

  async reverse(v: AccVoucher): Promise<void> {
    const r = await Swal.fire({
      icon: 'question', title: `¿Reversar ${TIPOS[v.type]} ${v.number}?`,
      text: 'Se crea una nota contable con los valores contrarios, con la fecha de hoy. El comprobante queda anulado, no se borra.',
      input: 'text', inputPlaceholder: 'Motivo', showCancelButton: true, confirmButtonText: 'Reversar', cancelButtonText: 'Cancelar',
      inputValidator: (x) => (!String(x || '').trim() ? 'Escribe el motivo' : null),
    });
    if (!r.isConfirmed) return;
    this.api.reverse(v.id, r.value).subscribe({ next: () => { this.detail = null; this.loadVouchers(); }, error: (e) => this.fail(e, 'No se pudo reversar') });
  }

  // ═══ Reportes
  runReport(): void {
    this.reportData = null;
    const done = (d: any) => (this.reportData = { kind: this.report, ...d });
    const err = (e: any) => this.fail(e, 'No se pudo generar el reporte');
    if (this.report === 'resultados') this.api.incomeStatement(this.rFrom, this.rTo).subscribe({ next: done, error: err });
    if (this.report === 'situacion') this.api.balanceSheet(this.rTo).subscribe({ next: done, error: err });
    if (this.report === 'prueba') this.api.trialBalance(this.rFrom, this.rTo).subscribe({ next: done, error: err });
    if (this.report === 'mayor') this.api.ledger(this.rAccount, this.rFrom, this.rTo).subscribe({ next: done, error: err });
  }

  indent(level: number): number {
    return Math.max(0, level - 1) * 14;
  }

  rowsWithMovement(rows: BalanceRow[]): BalanceRow[] {
    return (rows || []).filter((r) => r.opening || r.debit || r.credit || r.closing);
  }

  // ═══ Periodos
  loadPeriods(): void {
    const m: string[] = [];
    const d = new Date(`${hoy().slice(0, 7)}-01T12:00:00`);
    for (let i = 0; i < 12; i++) { m.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
    this.months = m;
    this.api.periods().subscribe((p) => (this.periods = p));
  }

  periodStatus(month: string): string {
    return this.periods.find((p) => p.month === month)?.status || 'ABIERTO';
  }

  async togglePeriod(month: string): Promise<void> {
    const closed = this.periodStatus(month) === 'CERRADO';
    const r = await Swal.fire({
      icon: 'question', title: closed ? `¿Reabrir ${month}?` : `¿Cerrar ${month}?`,
      text: closed ? 'Se podrán registrar o reversar comprobantes con fecha de ese mes.' : 'No se podrán registrar comprobantes con fecha de ese mes hasta reabrirlo.',
      showCancelButton: true, confirmButtonText: closed ? 'Reabrir' : 'Cerrar mes', cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;
    (closed ? this.api.reopenPeriod(month) : this.api.closePeriod(month)).subscribe({ next: () => this.loadPeriods(), error: (e) => this.fail(e, 'No se pudo cambiar el mes') });
  }
}
