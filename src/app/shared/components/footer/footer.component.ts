import { Component, OnInit, OnDestroy } from '@angular/core'; 
import { NAME_APP_SHORT } from '../../../config/config';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../services/factonet/factonet.service';
import { InvoiceRefreshService } from '../../services/invoice-refresh.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent implements OnInit, OnDestroy {

  nombreApp = NAME_APP_SHORT;
  currentDateTime: string = ''; 
  private intervalId: any;
  private refreshSubscription: Subscription = new Subscription();

  constructor(
    private factonetService: FactonetService,
    private invoiceRefreshService: InvoiceRefreshService
  ) {} 

  // Métricas de facturas y contratos
  pendingInvoices: number = 0;
  invoiceStats = {
    unconfirmed: 0,
    issued: 0,
    paid: 0
  };
  contractStats = {
    pending: 0,
    active: 0,
    suspended: 0,
    expired: 0
  }; 

  ngOnInit(): void {
    this.updateLiveDateTime(); 
    this.intervalId = setInterval(() => {
      this.updateLiveDateTime();
    }, 1000);
    
    this.loadDashboardMetrics();

    // Suscribirse al servicio de refresh
    this.refreshSubscription = this.invoiceRefreshService.refresh$.subscribe(() => {
      this.loadDashboardMetrics();
    });
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.refreshSubscription.unsubscribe();
  }

  /**
   * Carga las facturas y contratos reales desde los servicios.
   */
  loadDashboardMetrics(): void {
    // Cargar estadísticas de facturas
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        this.invoiceStats.unconfirmed = facturas.filter(f => f.status === 'Unconfirmed').length;
        this.invoiceStats.issued = facturas.filter(f => f.status === 'Issued').length;
        this.invoiceStats.paid = facturas.filter(f => f.status === 'Paid').length;
        this.pendingInvoices = facturas.filter(f => f.estado === 'Pendiente').length;
      },
      error: (error) => {
        this.invoiceStats = { unconfirmed: 0, issued: 0, paid: 0 };
        this.pendingInvoices = 0;
      }
    });

    // Cargar estadísticas de contratos
    this.factonetService.getContracts().subscribe({
      next: (contratos) => {
        this.contractStats.pending = contratos.filter(c => c.status === 'PENDING').length;
        this.contractStats.active = contratos.filter(c => c.status === 'ACTIVE').length;
        this.contractStats.suspended = contratos.filter(c => c.status === 'SUSPENDED').length;
        this.contractStats.expired = contratos.filter(c => c.status === 'EXPIRED').length;
      },
      error: (error) => {
        this.contractStats = { pending: 0, active: 0, suspended: 0, expired: 0 };
      }
    });
  }

  // Método público para refrescar desde otros componentes
  refreshDashboardMetrics(): void {
    this.loadDashboardMetrics();
  }

  /**
   * Obtiene y formatea la hora y fecha actual.
   */
  updateLiveDateTime(): void {
    const now = new Date();
    
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: 'short', year: 'numeric',
      hour12: true
    };
    
    this.currentDateTime = new Intl.DateTimeFormat('es-ES', options).format(now);
  }

}
