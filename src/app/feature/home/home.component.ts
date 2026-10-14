import { Component, HostListener, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { Subscription, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { AuthService } from '../../shared/services/auth/auth.service';
import { EsLabelPipe, esLabel } from '../../shared/pipes/es-label.pipe';
import { fechaLocal } from '../../shared/utils/fechas';
import { NewsBubble, bubblesFor, newIds, playNewsSound } from '../../shared/utils/news-bubbles';

Chart.register(...registerables);

/** Cada cuánto se refresca el resumen (solo con la pestaña visible). */
const REFRESH_MS = 30_000;
/** Cada cuánto se revisa el token, aunque la pestaña esté oculta. */
const KEEPALIVE_MS = 60_000;

interface InvoiceRow { id: number; numero: string; cliente: string; total: number; estado: string; vence: string }
interface ContractRow { id: string; code: string; cliente: string; paquete: string; estado: string; mensual: number; inicio: string; fin: string | null; dias?: number }
interface ContractsBlock {
  kpis: { total: number; active: number; newThisMonth: number; inProcess: number; suspended: number; expiringCount: number; expiringMrr: number; mrr: number; arr: number; avgMonthly: number };
  statusCount: Record<string, number>;
  byPackage: { name: string; active: number; mrr: number }[];
  byMode: Record<string, number>;
  months: { key: string; label: string; started: number; ended: number }[];
  expiring: ContractRow[];
  recent: ContractRow[];
  ids: string[];
}
interface Overview {
  generatedAt: string;
  scope: 'admin' | 'client';
  kpis: {
    billedMonth: number; billedPrevMonth: number; collectedMonth: number; collectedPrevMonth: number;
    openValue: number; openCount: number; overdueValue: number; overdueCount: number; dueSoonValue: number; dueSoonCount: number;
    reportedCount: number; reportedValue: number; unconfirmedCount: number; paidYear: number; collectionRate: number | null;
    totalInvoices: number; activeContracts: number; totalContracts: number; mrr: number;
  };
  contractsPending: { adminSignature: { id: string; code: string }[]; clientSignature: { id: string; code: string }[]; needsPdf: { id: string; code: string }[]; needsIssue: { id: string; code: string }[] };
  statusCount: Record<string, number>;
  months: { key: string; label: string; billed: number; collected: number }[];
  overdueInvoices: InvoiceRow[];
  dueSoonInvoices: InvoiceRow[];
  reportedInvoices: InvoiceRow[];
  topDebtors: { name: string; balance: number; overdue: number; count: number }[];
  recentInvoices: InvoiceRow[];
  invoiceIds?: number[];
  contracts?: ContractsBlock | null;
}
interface Attention { icon: string; tone: 'danger' | 'warning' | 'info'; count: number; label: string; detail: string; route: string }

const CONTRACT_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a', PENDING: '#f59e0b', DRAFT: '#cbd5e1', SUSPENDED: '#ea580c', RENEWED: '#0ea5e9',
  EXPIRED: '#94a3b8', CANCELLED: '#dc2626', TERMINATED: '#7f1d1d',
};
const MODE_LABELS: Record<string, string> = { MONTHLY: 'Mensual', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual' };
const VIEW_KEY = 'factonet_dash_view';
const SOUND_KEY = 'factonet_dash_sound';

const STATUS_COLORS: Record<string, string> = {
  Paid: '#16a34a', Issued: '#1877e4', 'Payment Reported': '#7c3aed', 'In arrears': '#dc2626',
  Notification1: '#f59e0b', Notification2: '#ea580c', Suspended: '#6b7280', Unconfirmed: '#cbd5e1',
};

/**
 * Dashboard de FactoNet en tiempo real. Administrador: facturación y cartera
 * de todo el ecosistema. Cliente: sus facturas y su contrato. No cierra
 * sesión por inactividad (IdleTimeoutService) y renueva el token solo.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, EsLabelPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  userRol: string | null = null;
  userName = '';
  isAuthorizedSigner = false;

  overview: Overview | null = null;
  loading = true;
  refreshing = false;
  stale = false;
  error: string | null = null;
  sessionEnded = false;
  lastUpdated: Date | null = null;
  now = Date.now();
  attention: Attention[] = [];
  contractAttention: Attention[] = [];
  statusBars: { key: string; label: string; count: number; color: string }[] = [];
  contractBars: { key: string; label: string; count: number; color: string }[] = [];
  modeBars: { label: string; count: number }[] = [];

  /** Administrador: vista de contratos (por defecto) o de facturación. */
  view: 'contracts' | 'billing' = 'contracts';
  /** Burbujas de novedades (factura o contrato nuevo) y su sonido. */
  bubbles: NewsBubble[] = [];
  soundOn = true;
  private seenInvoices: Set<number> | null = null;
  private seenContracts: Set<string> | null = null;

  activeContract: { code: string; packageName: string; description: string; monthlyValue: number; startDate: string; endDate: string; status: string; id?: string; clientSignedAt?: string | null; adminSignedAt?: string | null; pdfUrl?: string | null } | null = null;

  monthsChart: ChartData<'bar'> = { labels: [], datasets: [] };
  monthsChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${this.money(Number(c.parsed.y))}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,.06)' }, ticks: { font: { size: 11 }, callback: (v) => this.compactMoney(Number(v)) } },
    },
  };

  contractsChart: ChartData<'bar'> = { labels: [], datasets: [] };
  contractsChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,.06)' }, ticks: { font: { size: 11 }, precision: 0 } },
    },
  };

  private refreshTimer: any;
  private keepAliveTimer: any;
  private clockTimer: any;
  private sub?: Subscription;
  private readonly isBrowser: boolean;

  constructor(
    private factonetService: FactonetService,
    private authService: AuthService,
    private zone: NgZone,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get isAdmin(): boolean { return this.userRol === 'adminFactonet'; }
  get isClient(): boolean { return this.userRol === 'adminInvoices'; }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.userRol = sessionStorage.getItem('user_rol');
    const name = sessionStorage.getItem('user_name') || '';
    this.userName = name.includes('@') ? '' : name.split(' ')[0];
    this.isAuthorizedSigner = sessionStorage.getItem('user_isAuthorizedSigner') === 'true';
    try {
      if (localStorage.getItem(VIEW_KEY) === 'billing') this.view = 'billing';
      this.soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
    } catch { /* sin almacenamiento */ }
    this.refresh();
    if (this.isClient) this.loadActiveContract();
    this.refreshTimer = setInterval(() => { if (!document.hidden) this.refresh(); }, REFRESH_MS);
    this.keepAliveTimer = setInterval(() => this.keepAlive(), KEEPALIVE_MS);
    this.zone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.zone.run(() => (this.now = Date.now())), 5_000);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    clearInterval(this.keepAliveTimer);
    clearInterval(this.clockTimer);
    this.sub?.unsubscribe();
  }

  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (this.isBrowser && !document.hidden && this.lastUpdated && Date.now() - this.lastUpdated.getTime() > 10_000) this.refresh();
  }

  refresh(): void {
    if (this.refreshing || this.sessionEnded) return;
    this.refreshing = true;
    this.sub?.unsubscribe();
    this.sub = this.authService.renewSessionIfNeeded().pipe(
      switchMap(() => this.factonetService.getDashboardOverview()),
    ).subscribe({
      next: (o: Overview) => {
        this.overview = o;
        this.buildDerived(o);
        this.detectNews(o);
        this.lastUpdated = new Date();
        this.now = Date.now();
        this.loading = this.refreshing = this.stale = false;
        this.error = null;
      },
      error: () => {
        this.refreshing = this.loading = false;
        if (this.authService.sessionExpired()) { this.endSession(); return; }
        if (this.overview) this.stale = true;
        else this.error = 'No se pudo cargar el resumen. Se reintentará automáticamente.';
      },
    });
  }

  private keepAlive(): void {
    if (this.sessionEnded) return;
    this.authService.renewSessionIfNeeded().subscribe(() => {
      if (this.authService.sessionExpired()) this.endSession();
    });
  }

  private endSession(): void {
    this.sessionEnded = true;
    clearInterval(this.refreshTimer);
    clearInterval(this.keepAliveTimer);
  }

  goToLogin(): void {
    sessionStorage.clear();
    window.location.href = '/login';
  }

  private buildDerived(o: Overview): void {
    const a: Attention[] = [];
    const k = o.kpis;
    const ca: Attention[] = [];
    if (this.isAdmin) {
      if (k.reportedCount) a.push({ icon: 'file-earmark-check', tone: 'warning', count: k.reportedCount, label: 'Pagos reportados por verificar', detail: `${this.money(k.reportedValue)} con comprobante`, route: '/invoices' });
      if (k.overdueCount) a.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: k.overdueCount, label: 'Facturas vencidas', detail: `${this.money(k.overdueValue)} en mora`, route: '/invoices' });
      if (k.unconfirmedCount) a.push({ icon: 'receipt', tone: 'info', count: k.unconfirmedCount, label: 'Facturas por confirmar', detail: 'Generadas, pendientes de emitir', route: '/invoices' });
      const c = o.contractsPending;
      if (c.adminSignature.length) ca.push({ icon: 'pen-fill', tone: 'warning', count: c.adminSignature.length, label: 'Contratos por tu firma', detail: 'El cliente ya firmó', route: '/contracts' });
      const ck = o.contracts?.kpis;
      if (ck?.expiringCount) ca.push({ icon: 'calendar-x', tone: 'warning', count: ck.expiringCount, label: 'Vencen en 30 días', detail: `${this.money(ck.expiringMrr)} al mes por renovar`, route: '/contracts' });
      if (ck?.suspended) ca.push({ icon: 'pause-circle', tone: 'danger', count: ck.suspended, label: 'Contratos suspendidos', detail: 'Servicio detenido por falta de pago', route: '/contracts' });
      if (c.needsPdf.length) ca.push({ icon: 'file-earmark-pdf', tone: 'info', count: c.needsPdf.length, label: 'Contratos sin PDF', detail: 'Genera el PDF para emitirlos', route: '/contracts' });
      if (c.needsIssue.length) ca.push({ icon: 'send', tone: 'info', count: c.needsIssue.length, label: 'Contratos por emitir', detail: 'El PDF está listo para enviarlo al cliente', route: '/contracts' });
      if (c.clientSignature.length) ca.push({ icon: 'hourglass-split', tone: 'info', count: c.clientSignature.length, label: 'Esperando firma del cliente', detail: 'Contratos emitidos sin firmar', route: '/contracts' });
    } else {
      if (k.overdueCount) a.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: k.overdueCount, label: 'Facturas vencidas', detail: `${this.money(k.overdueValue)} por pagar: págalas para evitar la suspensión`, route: '/invoices' });
      if (k.dueSoonCount) a.push({ icon: 'calendar-event', tone: 'warning', count: k.dueSoonCount, label: 'Vencen en 7 días', detail: `${this.money(k.dueSoonValue)} por pagar`, route: '/invoices' });
      if (k.reportedCount) a.push({ icon: 'hourglass-split', tone: 'info', count: k.reportedCount, label: 'Pagos en verificación', detail: 'Reportaste el pago; CycloNet lo está revisando', route: '/invoices' });
    }
    this.attention = a;
    this.contractAttention = ca;
    this.buildContracts(o.contracts || null);

    const order = ['Paid', 'Issued', 'Payment Reported', 'Notification1', 'Notification2', 'In arrears', 'Suspended', 'Unconfirmed'];
    this.statusBars = order.filter((s) => o.statusCount[s]).map((s) => ({ key: s, label: esLabel(s), count: o.statusCount[s], color: STATUS_COLORS[s] }));

    this.monthsChart = {
      labels: o.months.map((m) => m.label),
      datasets: [
        { label: 'Facturado', data: o.months.map((m) => m.billed), backgroundColor: 'rgba(24, 119, 228, 0.28)', borderRadius: 6, barPercentage: 0.7 },
        { label: 'Recaudado', data: o.months.map((m) => m.collected), backgroundColor: '#1877e4', borderRadius: 6, barPercentage: 0.7 },
      ],
    };
  }

  private buildContracts(c: ContractsBlock | null): void {
    if (!c) { this.contractBars = []; this.modeBars = []; return; }
    const order = ['ACTIVE', 'PENDING', 'DRAFT', 'SUSPENDED', 'RENEWED', 'EXPIRED', 'CANCELLED', 'TERMINATED'];
    this.contractBars = order.filter((s) => c.statusCount[s]).map((s) => ({ key: s, label: esLabel(s), count: c.statusCount[s], color: CONTRACT_COLORS[s] }));
    this.modeBars = Object.entries(c.byMode).map(([m, n]) => ({ label: MODE_LABELS[m] || m, count: n })).sort((a, b) => b.count - a.count);
    this.contractsChart = {
      labels: c.months.map((m) => m.label),
      datasets: [
        { label: 'Nuevos', data: c.months.map((m) => m.started), backgroundColor: '#16a34a', borderRadius: 6, barPercentage: 0.7 },
        { label: 'Terminados', data: c.months.map((m) => m.ended), backgroundColor: 'rgba(220, 38, 38, 0.35)', borderRadius: 6, barPercentage: 0.7 },
      ],
    };
  }

  // ─── Novedades: burbujas con sonido ─────────────────────────────────────

  /** Compara con la consulta anterior; la primera carga no avisa. */
  private detectNews(o: Overview): void {
    const invoiceIds = o.invoiceIds || o.recentInvoices.map((i) => i.id);
    const contractIds = o.contracts?.ids || [];
    const freshInvoices = newIds(this.seenInvoices, invoiceIds);
    const freshContracts = this.isAdmin ? newIds(this.seenContracts, contractIds) : [];
    this.seenInvoices = new Set(invoiceIds);
    if (this.isAdmin) this.seenContracts = new Set(contractIds);

    const inv = (id: number) => o.recentInvoices.find((i) => i.id === id);
    const con = (id: string) => o.contracts?.recent.find((c) => c.id === id);
    const fresh = [
      ...bubblesFor('contract', freshContracts, (id) => {
        const c = con(id);
        return { title: 'Nuevo contrato', detail: c ? `${c.code} · ${c.cliente} · ${c.paquete}` : 'Revísalo en Contratos' };
      }),
      ...bubblesFor('invoice', freshInvoices, (id) => {
        const i = inv(id);
        return { title: this.isAdmin ? 'Nueva factura' : 'Tienes una factura nueva', detail: i ? `${i.numero}${this.isAdmin ? ' · ' + i.cliente : ''} · ${this.money(i.total)}` : 'Revísala en Facturas' };
      }),
    ];
    if (!fresh.length) return;
    this.bubbles = [...fresh, ...this.bubbles].slice(0, 5);
    if (this.soundOn) playNewsSound(fresh[0].kind);
    for (const b of fresh) setTimeout(() => this.dismissBubble(b.id), 9000);
  }

  dismissBubble(id: string): void {
    this.bubbles = this.bubbles.filter((b) => b.id !== id);
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    try { localStorage.setItem(SOUND_KEY, this.soundOn ? 'on' : 'off'); } catch { /* sin almacenamiento */ }
    if (this.soundOn) playNewsSound('invoice');
  }

  setView(v: 'contracts' | 'billing'): void {
    this.view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ }
  }

  trackByBubble = (_: number, b: NewsBubble) => b.id;
  contractColor = (s: string) => CONTRACT_COLORS[s] || '#94a3b8';

  // ─── Formato ────────────────────────────────────────────────────────────

  delta(current: number, previous: number): number | null {
    if (!previous) return current ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  money(v: number): string { return '$' + Math.round(v || 0).toLocaleString('es-CO'); }

  compactMoney(value: number): string {
    const v = Math.round(value || 0);
    if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
    if (Math.abs(v) >= 10_000) return '$' + Math.round(v / 1000).toLocaleString('es-CO') + ' mil';
    return this.money(v);
  }

  shortDate(v: string): string {
    return fechaLocal(v)?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) ?? '—';
  }

  longDate(v: string): string {
    return fechaLocal(v)?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date());
  }

  get updatedLabel(): string {
    if (!this.lastUpdated) return '';
    const s = Math.max(0, Math.round((this.now - this.lastUpdated.getTime()) / 1000));
    return s < 10 ? 'justo ahora' : s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
  }

  get statusTotal(): number { return this.statusBars.reduce((s, b) => s + b.count, 0) || 1; }

  trackByLabel = (_: number, a: Attention) => a.label;
  trackById = (_: number, r: { id: number | string }) => r.id;

  // ─── Contrato del cliente ───────────────────────────────────────────────

  /**
   * Carga (o recarga) el contrato del usuario. Se llama al entrar y después de
   * firmar, para mostrar el estado real y no actuar sobre datos viejos.
   */
  private loadActiveContract(): void {
    this.factonetService.getContracts().subscribe({
      next: (contracts) => {
        const contract = contracts[0];
        if (!contract) return;
        const value = typeof contract.value === 'string' ? parseFloat(contract.value) : contract.value;
        this.activeContract = {
          id: contract.id,
          code: contract.code,
          packageName: contract.package?.name || contract.packageName || 'N/A',
          description: contract.package?.description || '',
          monthlyValue: contract.mode === 'MONTHLY' ? value / 12 : value,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
          clientSignedAt: contract.clientSignedAt || null,
          adminSignedAt: contract.adminSignedAt || null,
          pdfUrl: contract.pdfUrl || null,
        };
      },
      error: () => {},
    });
  }

  openPdfModal(): void {
    if (!this.activeContract?.id) return;
    window.open(this.factonetService.getContractPdfUrl(this.activeContract.id), '_blank');
  }

  downloadPdf(): void {
    if (!this.activeContract?.id) return;
    const a = document.createElement('a');
    a.href = this.factonetService.getContractPdfUrl(this.activeContract.id);
    a.download = `Contrato_${this.activeContract.code}.pdf`;
    a.target = '_blank';
    a.click();
  }

  signMyContract(): void {
    if (!this.activeContract?.id) return;
    const clientName = sessionStorage.getItem('user_name') || sessionStorage.getItem('user_email') || 'Cliente';
    Swal.fire({
      title: 'Firmar contrato',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>Al firmar, aceptas los términos del contrato <strong>${this.activeContract.code}</strong>.</p>
          <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px; margin-bottom: 12px;">
            <p style="margin:0;"><strong>Paquete:</strong> ${this.activeContract.packageName}</p>
            <p style="margin:4px 0 0;"><strong>Valor:</strong> $${this.activeContract.monthlyValue.toLocaleString('es-CO')} COP/mes</p>
          </div>
          <label style="font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="swal-accept-terms" style="margin-right: 6px;">
            Acepto los términos y condiciones del contrato
          </label>
        </div>`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Firmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      preConfirm: () => {
        const accepted = (document.getElementById('swal-accept-terms') as HTMLInputElement)?.checked;
        if (!accepted) {
          Swal.showValidationMessage('Debes aceptar los términos para firmar');
          return false;
        }
        return true;
      },
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.factonetService.signAsClient(this.activeContract!.id!, clientName).subscribe({
        next: (response) => {
          this.loadActiveContract();
          this.refresh();
          Swal.fire({
            icon: 'success',
            title: response.status === 'ACTIVE' ? '¡Contrato firmado y activado!' : '¡Firma registrada!',
            html: response.status === 'ACTIVE'
              ? '<p>Ambas partes firmaron. Tu cuenta está activa.</p>'
              : '<p>Tu firma quedó registrada. Falta la firma del administrador.</p>',
            confirmButtonColor: '#1877e4',
          });
        },
        error: (error) => {
          const msg = error.error?.message || 'No se pudo registrar la firma.';
          if (msg.includes('ya ha firmado')) this.loadActiveContract();
          Swal.fire('Error', msg, 'error');
        },
      });
    });
  }
}
