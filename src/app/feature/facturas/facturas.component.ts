import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { NotificationsComponent } from "../../shared/components/notifications/notifications.component";

interface Factura {
  id: string;
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

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadMockFacturas();
    this.showToast(
      'Módulo de Facturación Inicializado: Datos de prueba cargados correctamente.',
      'primary', 'B', 1
    );
  }

  loadMockFacturas(): void {
    this.facturas = [
      { id: 'F-1001', numero: 'INV-2024-001', cliente: 'Solaris Energy Group', fechaEmision: '2024-10-15', fechaVencimiento: '2024-11-15', total: 15300.75, estado: 'Pendiente' },
      { id: 'F-1002', numero: 'INV-2024-002', cliente: 'Quantum Robotics', fechaEmision: '2024-09-01', fechaVencimiento: '2024-10-01', total: 450.00, estado: 'Vencida' },
      { id: 'F-1003', numero: 'INV-2024-003', cliente: 'Alpha Logistics Inc.', fechaEmision: '2024-08-20', fechaVencimiento: '2024-09-20', total: 820.75, estado: 'Pagada' },
      { id: 'F-1004', numero: 'INV-2024-004', cliente: 'Digital Forge Studio', fechaEmision: '2024-11-05', fechaVencimiento: '2024-12-05', total: 980.00, estado: 'Pendiente' },
    ];
  }

  getStatusClass(estado: Factura['estado']): string {
    switch (estado) {
      case 'Pagada': return 'text-green-700 bg-green-100';
      case 'Pendiente': return 'text-yellow-700 bg-yellow-100';
      case 'Vencida': return 'text-red-700 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  openFacturaModal() {
    this.isModalOpen = true;
    this.showToast('Abriendo interfaz de Creación de Factura...', 'primary', 'A', 0);
  }

  confirmDeleteFactura(factura: Factura) {
    this.facturas = this.facturas.filter(f => f.id !== factura.id);
    this.showToast(`Factura ${factura.numero} eliminada correctamente.`, 'danger', 'A', 0);
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
