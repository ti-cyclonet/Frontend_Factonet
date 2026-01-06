import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { InvoiceRefreshService } from '../../shared/services/invoice-refresh.service';

interface Factura {
  id: number;
  numero: string;
  cliente: string;
  fechaEmision: string;
  fechaVencimiento: string;
  total: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida';
  operationTypes?: Record<string, string>;
  [key: string]: any; // Para parámetros dinámicos
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
  filteredFacturas: Factura[] = [];
  paginatedFacturas: Factura[] = [];
  notifications: NotificationItem[] = [];
  selectedFactura: Factura | null = null;
  isModalOpen = false;
  dynamicColumns: string[] = [];
  Math = Math;

  // Filtros
  filters = {
    status: '',
    number: '',
    client: '',
    dateFrom: '',
    dateTo: ''
  };
  dynamicFilters: { [key: string]: string } = {};

  // Paginación
  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 0; // Columnas dinámicas de parámetros

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService,
    private invoiceRefreshService: InvoiceRefreshService
  ) {}

  ngOnInit(): void {
    this.loadFacturas();
  }

  loadFacturas(): void {
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        this.facturas = facturas || [];
        this.filteredFacturas = [...this.facturas];
        this.detectDynamicColumns();
        this.updatePagination();
        if (this.facturas.length > 0) {
          this.showToast(`${this.facturas.length} facturas cargadas desde Authoriza`, 'success', 'A', 0);
        } else {
          this.showToast('No hay facturas disponibles en Authoriza', 'primary', 'A', 0);
        }
      },
      error: (error) => {

        this.facturas = [];
        this.dynamicColumns = [];
        this.showToast('Error conectando con Authoriza Backend', 'danger', 'A', 0);
      }
    });
  }

  private detectDynamicColumns(): void {
    this.dynamicColumns = [];
    
    if (this.facturas.length > 0) {
      // Buscar todas las propiedades que no son campos base en TODAS las facturas
      const baseFields = ['id', 'numero', 'cliente', 'fechaEmision', 'fechaVencimiento', 'total', 'estado', 'operationTypes', 'percentages'];
      
      this.facturas.forEach(factura => {
        Object.keys(factura).forEach(key => {
          if (!baseFields.includes(key) && 
              !this.dynamicColumns.includes(key)) {
            // Agregar la columna incluso si el valor es null/undefined para mantener el histórico
            this.dynamicColumns.push(key);
          }
        });
      });
    }
  }

  getColumnLabel(column: string, factura?: Factura): string {
    const baseLabels: { [key: string]: string } = {
      'iva': 'IVA',
      'profit_margin': 'Profit Margin',
      'financing_interest': 'Financing Interest',
      'global_discount': 'Global Discount',
      'late_fee_penalty': 'Late Fee Penalty',
      'BLACK_FRIDAY_DISCOUNT': 'Black Friday Discount',
      'RTE_FUENTE': 'RTE Fuente',
      'currency': 'Currency'
    };
    
    return baseLabels[column] || column;
  }

  sweepInvoices(): void {
    this.factonetService.sweepInvoices().subscribe({
      next: (result) => {
        this.showToast(`Barrido completado: ${result.generated} facturas generadas`, 'success', 'A', 0);
        this.loadFacturas(); // Recargar la lista
        this.invoiceRefreshService.triggerRefresh(); // Notificar a header y footer
      },
      error: (error) => {

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

  calculateFinalTotal(factura: Factura): number {
    let finalTotal = factura.total;
    
    if (factura['operationTypes']) {
      this.dynamicColumns.forEach(column => {
        const value = factura[column];
        const operationType = factura['operationTypes']?.[column];
        
        if (value && operationType) {
          if (operationType === 'subtract') {
            finalTotal -= value;
          } else {
            finalTotal += value;
          }
        }
      });
    }
    
    return finalTotal;
  }

  private initializeDynamicFilters(): void {
    this.dynamicFilters = {};
    this.dynamicColumns.forEach(column => {
      this.dynamicFilters[column] = '';
    });
  }

  applyFilters(): void {
    this.filteredFacturas = this.facturas.filter(factura => {
      // Filtro por estado
      if (this.filters.status && factura.estado !== this.filters.status) {
        return false;
      }

      // Filtro por número
      if (this.filters.number && !factura.numero.toLowerCase().includes(this.filters.number.toLowerCase())) {
        return false;
      }

      // Filtro por cliente
      if (this.filters.client && !factura.cliente.toLowerCase().includes(this.filters.client.toLowerCase())) {
        return false;
      }

      // Filtro por fecha desde
      if (this.filters.dateFrom && factura.fechaEmision < this.filters.dateFrom) {
        return false;
      }

      // Filtro por fecha hasta
      if (this.filters.dateTo && factura.fechaEmision > this.filters.dateTo) {
        return false;
      }

      return true;
    });
    
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredFacturas.length / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedFacturas = this.filteredFacturas.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  clearFilters(): void {
    this.filters = {
      status: '',
      number: '',
      client: '',
      dateFrom: '',
      dateTo: ''
    };
    this.filteredFacturas = [...this.facturas];
    this.currentPage = 1;
    this.updatePagination();
  }

  // ------------------ NOTIFICACIONES ------------------
  removeNotification(index: number) {
    this.notifications.splice(index, 1);
    this.cdr.detectChanges();
  }

  trackById(index: number, factura: Factura): number {
    return factura.id;
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