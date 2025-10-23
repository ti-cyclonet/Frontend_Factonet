import { Component, OnInit, OnDestroy } from '@angular/core'; 
import { NAME_APP_SHORT } from '../../../config/config';
import { CommonModule } from '@angular/common';

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

  // ==========================================================
  // NUEVAS PROPIEDADES PARA LAS MÉTRICAS DE FACTURACIÓN (MOCK)
  // Estas serán reemplazadas por llamadas a un servicio real.
  // ==========================================================
  pendingInvoices: number = 7; 
  paidInvoices: number = 42; 

  ngOnInit(): void {
    this.updateLiveDateTime(); 
    this.intervalId = setInterval(() => {
      this.updateLiveDateTime();
    }, 1000);
    
    // Aquí se iniciaría la lógica para cargar las métricas reales
    // this.loadInvoiceMetrics(); 
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
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
