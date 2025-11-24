import { Component, OnInit, OnDestroy } from '@angular/core'; 
import { NAME_APP_SHORT } from '../../../config/config';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardMetrics } from '../../services/dashboard/dashboard.service';

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

  constructor(private dashboardService: DashboardService) {} 

  // Métricas del dashboard
  pendingInvoices: number = 0; 
  paidInvoices: number = 0;
  totalContracts: number = 0;
  activeContracts: number = 0; 

  ngOnInit(): void {
    this.updateLiveDateTime(); 
    this.intervalId = setInterval(() => {
      this.updateLiveDateTime();
    }, 1000);
    
    this.loadDashboardMetrics();
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Carga las métricas del dashboard desde el backend.
   */
  loadDashboardMetrics(): void {
    this.dashboardService.getDashboardMetrics().subscribe({
      next: (metrics: DashboardMetrics) => {
        this.pendingInvoices = metrics.pendingInvoices || 0;
        this.paidInvoices = metrics.paidInvoices || 0;
        this.totalContracts = metrics.totalContracts || 0;
        this.activeContracts = metrics.activeContracts || 0;
      },
      error: (error) => {
        console.error('Error cargando métricas:', error);
        // Mostrar ceros si no hay conexión
        this.pendingInvoices = 0;
        this.paidInvoices = 0;
        this.totalContracts = 0;
        this.activeContracts = 0;
      }
    });
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
