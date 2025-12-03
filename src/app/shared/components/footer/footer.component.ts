import { Component, OnInit, OnDestroy } from '@angular/core'; 
import { NAME_APP_SHORT } from '../../../config/config';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../services/factonet/factonet.service';

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

  constructor(private factonetService: FactonetService) {} 

  // Métricas de facturas reales
  pendingInvoices: number = 0; 

  ngOnInit(): void {
    this.updateLiveDateTime(); 
    this.intervalId = setInterval(() => {
      this.updateLiveDateTime();
    }, 1000);
    
    this.loadDashboardMetrics();
    
    // Actualizar métricas cada 30 segundos
    setInterval(() => {
      this.loadDashboardMetrics();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Carga las facturas reales desde Authoriza.
   */
  loadDashboardMetrics(): void {
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        this.pendingInvoices = facturas.filter(f => f.estado === 'Pendiente').length;
      },
      error: (error) => {
        console.error('Error cargando facturas:', error);
        this.pendingInvoices = 0;
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
