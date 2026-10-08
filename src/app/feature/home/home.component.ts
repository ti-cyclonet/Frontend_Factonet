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

Chart.register(...registerables);

/** Cada cuánto se refresca el resumen (solo con la pestaña visible). */
const REFRESH_MS = 30_000;
/** Cada cuánto se revisa el token, aunque la pestaña esté oculta. */
const KEEPALIVE_MS = 60_000;

interface InvoiceRow { id: number; numero: string; cliente: string; total: number; estado: string; vence: string }
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
}
interface Attention { icon: string; tone: 'danger' | 'warning' | 'info'; count: number; label: string; detail: string; route: string }

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
  statusBars: { key: string; label: string; count: number; color: string }[] = [];

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
    if (this.isAdmin) {
      if (k.reportedCount) a.push({ icon: 'file-earmark-check', tone: 'warning', count: k.reportedCount, label: 'Pagos reportados por verificar', detail: `${this.money(k.reportedValue)} con comprobante`, route: '/invoices' });
      if (k.overdueCount) a.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: k.overdueCount, label: 'Facturas vencidas', detail: `${this.money(k.overdueValue)} en mora`, route: '/invoices' });
      if (k.unconfirmedCount) a.push({ icon: 'receipt', tone: 'info', count: k.unconfirmedCount, label: 'Facturas por confirmar', detail: 'Generadas, pendientes de emitir', route: '/invoices' });
      const c = o.contractsPending;
      if (c.adminSignature.length) a.push({ icon: 'pen-fill', tone: 'warning', count: c.adminSignature.length, label: 'Contratos por tu firma', detail: 'El cliente ya firmó', route: '/contracts' });
      if (c.needsPdf.length) a.push({ icon: 'file-earmark-pdf', tone: 'info', count: c.needsPdf.length, label: 'Contratos sin PDF', detail: 'Genera el PDF para emitirlos', route: '/contracts' });
      if (c.needsIssue.length) a.push({ icon: 'send', tone: 'info', count: c.needsIssue.length, label: 'Contratos por emitir', detail: 'El PDF está listo para enviarlo al cliente', route: '/contracts' });
      if (c.clientSignature.length) a.push({ icon: 'hourglass-split', tone: 'info', count: c.clientSignature.length, label: 'Esperando firma del cliente', detail: 'Contratos emitidos sin firmar', route: '/contracts' });
    } else {
      if (k.overdueCount) a.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: k.overdueCount, label: 'Facturas vencidas', detail: `${this.money(k.overdueValue)} por pagar: págalas para evitar la suspensión`, route: '/invoices' });
      if (k.dueSoonCount) a.push({ icon: 'calendar-event', tone: 'warning', count: k.dueSoonCount, label: 'Vencen en 7 días', detail: `${this.money(k.dueSoonValue)} por pagar`, route: '/invoices' });
      if (k.reportedCount) a.push({ icon: 'hourglass-split', tone: 'info', count: k.reportedCount, label: 'Pagos en verificación', detail: 'Reportaste el pago; CycloNet lo está revisando', route: '/invoices' });
    }
    this.attention = a;

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
