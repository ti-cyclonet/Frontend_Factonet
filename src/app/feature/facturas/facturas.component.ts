import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';

interface Factura {
  id: number;
  numero: string;
  cliente: string;
  fechaEmision: string;
  fechaVencimiento: string;
  total: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida';
}

interface NotificationItem {
  title: string;
  type: 'success' | 'warning' | 'danger' | 'primary';
  alertType: 'A' | 'B';
  container: 0 | 1;
  visible: boolean;
}

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, UpperCasePipe],
  templateUrl: './facturas.component.html',
  styleUrls: ['./facturas.component.css']
})
export class FacturasComponent implements OnInit {
  facturas: Factura[] = [];
  notifications: NotificationItem[] = [];
  selectedFactura: Factura | null = null;
  isModalOpen = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService
  ) {}

  ngOnInit(): void {
    this.loadFacturas();
  }

  loadFacturas(): void {
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        this.facturas = facturas || [];
        if (this.facturas.length > 0) {
          this.showToast(`${this.facturas.length} facturas cargadas desde Authoriza`, 'success', 'A', 0);
        } else {
          this.showToast('No hay facturas disponibles en Authoriza', 'primary', 'A', 0);
        }
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
        this.facturas = [];
        this.showToast('Error conectando con Authoriza Backend', 'danger', 'A', 0);
      }
    });
  }

  sweepInvoices(): void {
    this.factonetService.sweepInvoices().subscribe({
      next: (result) => {
        this.showToast(`Barrido completado: ${result.generated} facturas generadas`, 'success', 'A', 0);
        this.loadFacturas(); // Recargar la lista
      },
      error: (error) => {
        console.error('Error executing sweep:', error);
        this.showToast('Error ejecutando barrido de facturas', 'danger', 'A', 0);
      }
    });
  }

  setSelectedFactura(factura: Factura) {
    if (this.selectedFactura === factura) {
      this.selectedFactura = null;
    } else {
      this.selectedFactura = factura;
      this.showToast(`Factura ${factura.numero} seleccionada`, 'success', 'A', 0);
    }
  }

  editFactura(factura: Factura) {
    this.showToast(`Editando factura ${factura.numero}`, 'warning', 'A', 0);
  }

  confirmDeleteFactura(factura: Factura) {
    this.facturas = this.facturas.filter(f => f.id !== factura.id);
    this.showToast(`Factura ${factura.numero} eliminada correctamente.`, 'danger', 'A', 0);
    this.selectedFactura = null;
    this.cdr.detectChanges();
  }

  trackById(index: number, factura: Factura) {
    return factura.id;
  }

  // ------------------ NOTIFICACIONES ------------------
  removeNotification(index: number) {
    this.notifications.splice(index, 1);
    this.cdr.detectChanges();
  }

  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
    const notification: NotificationItem = { title: message, type, alertType, container, visible: true };
    this.notifications.push(notification);
    this.cdr.detectChanges();

    if (alertType === 'A') {
      setTimeout(() => {
        const index = this.notifications.indexOf(notification);
        if (index > -1) this.notifications[index].visible = false;
        this.cdr.detectChanges();
      }, 4000);
    }
  }
}