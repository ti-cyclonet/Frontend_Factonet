import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AccAccount, AccLine, AccThirdParty, AccVoucher, AccountingService, BalanceRow, InboxDoc } from '../../shared/services/accounting.service';

type Tab = 'resumen' | 'comprobantes' | 'recibidas' | 'reportes' | 'cuentas' | 'terceros' | 'periodos';
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
  company: { name: string; nit: string | null; autoFrom: string | null; accountMap?: Record<string, string> } | null = null;
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

  // Facturas recibidas de proveedores
  inboxFilter: 'PENDIENTE' | '' | 'CONTABILIZADA' | 'PROBLEMAS' | 'DESCARTADA' = 'PENDIENTE';
  inboxDocs: InboxDoc[] = [];
  inboxCfg: { address: string | null; mailbox: boolean } | null = null;
  inboxSel: InboxDoc | null = null;
  approveForm = { accountCode: '', saveRule: true, date: '' };
  pendingCount = 0;
  readonly inboxStatus: Record<string, string> = {
    PENDIENTE: 'Por aprobar', CONTABILIZADA: 'Contabilizada', DUPLICADA: 'Duplicada', RECHAZADA: 'No es para nosotros',
    SIN_XML: 'Sin XML', ERROR: 'No se pudo leer', DESCARTADA: 'Descartada',
  };

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
          this.api.inbox('PENDIENTE').subscribe({ next: (d) => (this.pendingCount = d.length), error: () => {} });
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
    if (t === 'recibidas') this.loadInbox();
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

  // ═══ Facturas recibidas
  loadInbox(): void {
    if (!this.inboxCfg) this.api.inboxConfig().subscribe({ next: (c) => (this.inboxCfg = c), error: () => {} });
    const status = this.inboxFilter === 'PROBLEMAS' ? 'SIN_XML,ERROR,RECHAZADA,DUPLICADA' : this.inboxFilter;
    this.api.inbox(status).subscribe({
      next: (d) => {
        this.inboxDocs = d;
        if (this.inboxFilter === 'PENDIENTE') this.pendingCount = d.length;
      },
      error: (e) => this.fail(e, 'No se pudieron cargar las facturas recibidas'),
    });
  }

  setInboxFilter(f: ContabilidadComponent['inboxFilter']): void {
    this.inboxFilter = f;
    this.inboxSel = null;
    this.loadInbox();
  }

  openInbox(d: InboxDoc): void {
    this.api.inboxDoc(d.id).subscribe((full) => {
      this.inboxSel = full;
      this.approveForm = { accountCode: full.accountCode || '', saveRule: true, date: full.issueDate || hoy() };
    });
  }

  pollInbox(): void {
    this.busy = true;
    this.api.inboxPoll().subscribe({
      next: (r) => {
        this.busy = false;
        Swal.fire({
          icon: 'info',
          title: r.configured ? (r.emails ? `${r.emails} correo(s) nuevo(s)` : 'No hay correos nuevos') : 'El buzón aún no está configurado',
          text: r.configured ? `${r.documents} documento(s) recibido(s).` : 'Mientras tanto, carga los ZIP o XML de las facturas con el botón Cargar.',
          timer: 2500, showConfirmButton: false,
        });
        this.loadInbox();
      },
      error: (e) => this.fail(e, 'No se pudo revisar el buzón'),
    });
  }

  uploadInbox(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.busy = true;
    this.api.inboxUpload(files).subscribe({
      next: (res) => {
        this.busy = false;
        const html = res.map((r) => `<li><b>${this.esc(r.number || 'Documento')}</b> ${this.esc(r.supplierName || '')}: ${this.esc(this.inboxStatus[r.status] || r.status)}${r.message ? `<br><small>${this.esc(r.message)}</small>` : ''}</li>`).join('');
        Swal.fire({ icon: res.some((r) => r.status === 'PENDIENTE') ? 'success' : 'info', title: 'Facturas cargadas', html: `<ul style="text-align:left">${html}</ul>` });
        this.inboxFilter = 'PENDIENTE';
        this.loadInbox();
      },
      error: (e) => this.fail(e, 'No se pudieron cargar los archivos'),
    });
  }

  viewInboxPdf(d: InboxDoc): void {
    const win = window.open('', '_blank');
    this.api.inboxPdf(d.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (win) win.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => { win?.close(); this.fail(e, 'No se pudo abrir el PDF'); },
    });
  }

  /** Asiento que se creará al aprobar (mismo cálculo que el backend, inboxVoucherLines). */
  get inboxPreview(): AccLine[] {
    const d = this.inboxSel;
    const acc = this.approveForm.accountCode;
    if (!d || !acc) return [];
    const map: Record<string, string> = { proveedores: '220505', ivaCompras: 'gasto', retencionRenta: '236525', retencionIva: '236705', retencionIca: '236805', ...(this.company?.accountMap || {}) };
    const base = +d.base, iva = +d.iva, other = +d.otherTaxes;
    const toExpense = !map['ivaCompras'] || map['ivaCompras'] === 'gasto';
    const w: Record<string, number> = (d.data?.withholdings as any) || { renta: 0, iva: 0, ica: 0 };
    const lines: AccLine[] = [];
    const expense = r2(base + other + (toExpense ? iva : 0));
    if (expense) lines.push({ accountCode: acc, debit: expense, credit: 0 });
    if (!toExpense && iva) lines.push({ accountCode: map['ivaCompras'], debit: iva, credit: 0 });
    const debit = r2(lines.reduce((x, l) => x + l.debit, 0));
    let withheld = 0;
    for (const [k, code] of [['renta', map['retencionRenta']], ['iva', map['retencionIva']], ['ica', map['retencionIca']]]) {
      const v = r2(w[k]);
      if (v > 0) { lines.push({ accountCode: code, debit: 0, credit: v }); withheld += v; }
    }
    lines.push({ accountCode: map['proveedores'], debit: 0, credit: r2(debit - withheld) });
    return d.kind === 'CreditNote' ? lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })) : lines;
  }

  approveInbox(): void {
    const d = this.inboxSel;
    if (!d) return;
    this.busy = true;
    this.api.inboxApprove(d.id, this.approveForm).subscribe({
      next: (r) => {
        this.busy = false;
        Swal.fire({ icon: 'success', title: 'Factura contabilizada', text: `${TIPOS[r.voucher.type]} ${r.voucher.number}`, timer: 1800, showConfirmButton: false });
        this.inboxSel = null;
        this.loadInbox();
      },
      error: (e) => this.fail(e, 'No se pudo contabilizar'),
    });
  }

  async discardInbox(): Promise<void> {
    const d = this.inboxSel;
    if (!d) return;
    const r = await Swal.fire({ icon: 'question', title: '¿Descartar este documento?', text: 'No se contabiliza. Puedes reabrirlo después.', input: 'text', inputPlaceholder: 'Motivo (opcional)', showCancelButton: true, confirmButtonText: 'Descartar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    this.api.inboxDiscard(d.id, r.value || '').subscribe({ next: () => { this.inboxSel = null; this.loadInbox(); }, error: (e) => this.fail(e) });
  }

  reopenInbox(): void {
    const d = this.inboxSel;
    if (!d) return;
    this.api.inboxReopen(d.id).subscribe({ next: () => { this.inboxSel = null; this.setInboxFilter('PENDIENTE'); }, error: (e) => this.fail(e, 'No se pudo reabrir') });
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
