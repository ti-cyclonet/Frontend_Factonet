import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';

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
      { id: 'INV-2024-001', numero: 'FAC-001-2024', cliente: 'TechCorp Solutions', fechaEmision: '2024-01-15', fechaVencimiento: '2024-02-15', total: 25750.00, estado: 'Pagada' },
      { id: 'INV-2024-002', numero: 'FAC-002-2024', cliente: 'Global Industries Ltd', fechaEmision: '2024-01-20', fechaVencimiento: '2024-02-20', total: 18900.50, estado: 'Pendiente' },
      { id: 'INV-2024-003', numero: 'FAC-003-2024', cliente: 'Innovation Hub Inc', fechaEmision: '2024-01-10', fechaVencimiento: '2024-02-10', total: 12300.75, estado: 'Vencida' },
      { id: 'INV-2024-004', numero: 'FAC-004-2024', cliente: 'Digital Dynamics Corp', fechaEmision: '2024-01-25', fechaVencimiento: '2024-02-25', total: 8750.00, estado: 'Pendiente' }
    ];
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