import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { InvoiceRefreshService } from '../../shared/services/invoice-refresh.service';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';

interface Factura {
  id: number;
  numero: string;
  cliente: string;
  fechaEmision: string;
  fechaVencimiento: string;
  fechaPago?: string;
  total: number;
  estado: 'Unconfirmed' | 'Issued' | 'In arrears' | 'Notification1' | 'Notification2' | 'Suspended' | 'Payment Reported' | 'Paid';
  operationTypes?: Record<string, string>;
  percentages?: Record<string, number>;
  paymentVoucherUrl?: string;
  rejectionReason?: string;
  // Datos del cliente
  clienteNit?: string;
  clienteTipoPersona?: string;
  clienteEmail?: string;
  clienteContacto?: string;
  clienteTelefono?: string;
  clienteEmailContacto?: string;
  // Datos del contrato
  contratoCode?: string;
  contratoModo?: string;
  contratoPrefijo?: string;
  // Periodo de servicio
  periodoInicio?: string;
  periodoFin?: string;
  [key: string]: any;
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
export class FacturasComponent implements OnInit, OnDestroy {
  facturas: Factura[] = [];
  filteredFacturas: Factura[] = [];
  paginatedFacturas: Factura[] = [];
  notifications: NotificationItem[] = [];
  selectedFactura: Factura | null = null;
  modalFactura: Factura | null = null;
  isModalOpen = false;
  dynamicColumns: string[] = [];
  Math = Math;

  isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
  }

  // Control de visibilidad de filtros
  showFilters = false;
  userRol: string | null = null;

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

  // Estados permitidos para facturas
  invoiceStatuses = ['Unconfirmed', 'Issued', 'In arrears', 'Notification1', 'Notification2', 'Suspended', 'Payment Reported', 'Paid'];
  
  // Control del dropdown de estados
  statusDropdownOpen = signal<string | null>(null);
  statusDropdownPosition = signal<{top: number, left: number}>({top: 0, left: 0});

  // Loading state
  loading = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService,
    private invoiceRefreshService: InvoiceRefreshService
  ) {}

  ngOnInit(): void {
    this.userRol = sessionStorage.getItem('user_rol');
    this.loadFacturas();
    
    // Listener para cerrar dropdown al hacer click fuera
    document.addEventListener('click', () => {
      this.closeStatusDropdown();
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', () => {
      this.closeStatusDropdown();
    });
  }

  loadFacturas(): void {
    this.loading = true;
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        console.log('Facturas recibidas:', facturas);
        this.facturas = (facturas || []).map(factura => ({
          ...factura,
          estado: factura.estado || factura.status || 'Unconfirmed'
        }));
        
        // Ordenar facturas por fecha de emisión (más reciente primero)
        this.facturas.sort((a, b) => {
          const dateA = new Date(a.fechaEmision);
          const dateB = new Date(b.fechaEmision);
          return dateB.getTime() - dateA.getTime();
        });
        this.filteredFacturas = [...this.facturas];
        this.detectDynamicColumns();
        this.updatePagination();
        this.loading = false;

        // Check for rejected invoices and notify the client
        if (this.userRol === 'adminInvoices') {
          this.checkRejectedPayments();
        }
      },
      error: (error) => {
        console.error('Error cargando facturas:', error);
        this.facturas = [];
        this.dynamicColumns = [];
        this.loading = false;
        this.showToast('Error connecting to Authoriza Backend', 'danger', 'A', 0);
      }
    });
  }

  private detectDynamicColumns(): void {
    this.dynamicColumns = [];
    
    if (this.facturas.length > 0) {
      // Buscar todas las propiedades que no son campos base en TODAS las facturas
      const baseFields = ['id', 'numero', 'cliente', 'fechaEmision', 'fechaVencimiento', 'fechaPago', 'total', 'estado', 'operationTypes', 'percentages', 'paymentVoucherUrl', 'rejectionReason',
        'clienteNit', 'clienteTipoPersona', 'clienteEmail', 'clienteContacto', 'clienteTelefono', 'clienteEmailContacto',
        'contratoCode', 'contratoModo', 'contratoPrefijo', 'periodoInicio', 'periodoFin'];
      
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

  hasUnconfirmedInvoices(): boolean {
    return this.facturas.some(f => f.estado === 'Unconfirmed');
  }

  sweepInvoices(): void {
    if (this.loading) return; // Prevent double-click
    this.loading = true;

    this.factonetService.sweepInvoices().subscribe({
      next: (result) => {
        this.showToast(`Sweep completed: ${result.generated} invoices generated`, 'success', 'A', 0);
        this.loadFacturas(); // Recargar la lista
        this.invoiceRefreshService.triggerRefresh(); // Notificar a header y footer
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.showToast('Error executing invoice sweep', 'danger', 'A', 0);
      }
    });
  }

  setSelectedFactura(factura: Factura) {
    if (this.selectedFactura === factura) {
      this.selectedFactura = null;
    } else {
      this.selectedFactura = factura;
    }
  }

  editFactura(factura: Factura) {
    this.showToast(`Editing invoice ${factura.numero}`, 'warning', 'A', 0);
  }

  confirmDeleteFactura(factura: Factura) {
    this.facturas = this.facturas.filter(f => f.id !== factura.id);
    this.showToast(`Invoice ${factura.numero} deleted successfully.`, 'danger', 'A', 0);
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

  /**
   * Convierte un número a su representación en letras (español colombiano).
   */
  private numberToWords(num: number): string {
    const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (num === 0) return 'cero';
    if (num === 100) return 'cien';
    if (num === 1000000) return 'un millón';

    let result = '';

    // Millones
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      if (millions === 1) {
        result += 'un millón ';
      } else {
        result += this.convertHundreds(millions) + ' millones ';
      }
      num %= 1000000;
    }

    // Miles
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        result += 'mil ';
      } else {
        result += this.convertHundreds(thousands) + ' mil ';
      }
      num %= 1000;
    }

    // Centenas, decenas y unidades
    if (num > 0) {
      result += this.convertHundreds(num);
    }

    return result.trim();
  }

  private convertHundreds(num: number): string {
    const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    let result = '';

    if (num >= 100) {
      if (num === 100) {
        result += 'cien';
      } else {
        result += hundreds[Math.floor(num / 100)] + ' ';
      }
      num %= 100;
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        result += ' y ' + units[num % 10];
      }
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += units[num];
    }

    return result;
  }

  generateInvoicePDF(factura: Factura): void {
    const pdf = new jsPDF();
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const rightCol = pageW - margin;

    const logoImg = new Image();
    logoImg.onload = () => {
      const logoWidth = 50;
      const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
      pdf.addImage(logoImg, 'PNG', margin, 10, logoWidth, logoHeight);
      this.buildInvoicePDF(pdf, factura, margin, rightCol, pageW, pageH, Math.max(logoHeight + 12, 40));
    };
    logoImg.onerror = () => {
      this.buildInvoicePDF(pdf, factura, margin, rightCol, pageW, pageH, 10);
    };
    logoImg.src = 'assets/img/Cyclonet_nit.png';
  }

  private buildInvoicePDF(pdf: jsPDF, factura: Factura, margin: number, rightCol: number, pageW: number, pageH: number, startY: number): void {
    let y = startY;
    const col2X = pageW / 2 + 10;

    // ===== ENCABEZADO EMISOR =====
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cyclonet S. A. S.', col2X, 18);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('NIT: 901.515.884-4', col2X, 24);
    pdf.text('Responsable de IVA', col2X, 29);
    pdf.text('Bonanza, Mz 23 Lt 30 - Turbaco, Bolívar', col2X, 34);
    pdf.text('Tel: 314 414 4986 - 321 898 5475', col2X, 39);
    pdf.text('ti.cyclonet@hotmail.com', col2X, 44);

    // ===== BARRA TÍTULO =====
    y = Math.max(y, 50);
    pdf.setDrawColor(60, 60, 150);
    pdf.setFillColor(60, 60, 150);
    pdf.rect(margin, y, pageW - margin * 2, 10, 'F');
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('FACTURA DE VENTA', margin + 5, y + 7);
    pdf.text('No. ' + factura.numero, rightCol - 5, y + 7, { align: 'right' });
    pdf.setTextColor(0, 0, 0);

    // ===== DATOS DE LA FACTURA =====
    y += 16;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Fecha de expedición:', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(this.formatDate(factura.fechaEmision), margin + 42, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Fecha de vencimiento:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(this.formatDate(factura.fechaVencimiento), col2X + 44, y);

    y += 6;
    const modoLabel: Record<string, string> = { 'MONTHLY': 'Mensual', 'BIMONTHLY': 'Bimestral', 'QUARTERLY': 'Trimestral', 'SEMIANNUAL': 'Semestral', 'ANNUAL': 'Anual' };
    pdf.setFont('helvetica', 'bold');
    pdf.text('Forma de pago:', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(modoLabel[factura.contratoModo || ''] || 'Crédito', margin + 32, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Contrato:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.contratoCode || 'N/A', col2X + 20, y);

    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Periodo de servicio:', margin, y);
    pdf.setFont('helvetica', 'normal');
    const periodoTexto = this.formatDate(factura.periodoInicio || '') + ' a ' + this.formatDate(factura.periodoFin || '');
    pdf.text(periodoTexto, margin + 40, y);
    const estadoLabel: Record<string, string> = { 'Unconfirmed': 'Sin confirmar', 'Issued': 'Emitida', 'In arrears': 'En mora', 'Paid': 'Pagada', 'Suspended': 'Suspendida', 'Notification1': 'Notificación 1', 'Notification2': 'Notificación 2' };
    pdf.setFont('helvetica', 'bold');
    pdf.text('Estado:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(estadoLabel[factura.estado] || factura.estado, col2X + 16, y);

    y += 5;
    const diasCobrados = this.calculateDaysBetween(factura.periodoInicio, factura.periodoFin);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.text(`(${diasCobrados} días facturados)`, margin + 40, y);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');

    // ===== DATOS DEL CLIENTE =====
    y += 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(240, 240, 250);
    pdf.rect(margin, y, pageW - margin * 2, 30, 'FD');
    y += 6;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ADQUIRENTE / CLIENTE', margin + 3, y);
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Razón social:', margin + 3, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.cliente, margin + 30, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(factura.clienteTipoPersona === 'J' ? 'NIT:' : 'CC:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.clienteNit || 'N/A', col2X + 10, y);
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Contacto:', margin + 3, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.clienteContacto || 'N/A', margin + 22, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Tel:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.clienteTelefono || 'N/A', col2X + 10, y);
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', margin + 3, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.clienteEmailContacto || factura.clienteEmail || 'N/A', margin + 18, y);

    // ===== TABLA DE DETALLE =====
    y += 12;
    pdf.setFillColor(60, 60, 150);
    pdf.rect(margin, y, pageW - margin * 2, 8, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('CANT.', margin + 3, y + 6);
    pdf.text('DESCRIPCIÓN', margin + 20, y + 6);
    pdf.text('VR. UNITARIO', rightCol - 55, y + 6, { align: 'right' });
    pdf.text('VR. TOTAL', rightCol - 3, y + 6, { align: 'right' });
    pdf.setTextColor(0, 0, 0);

    y += 8;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, y, pageW - margin * 2, 8, 'D');
    pdf.setFont('helvetica', 'normal');
    pdf.text('1', margin + 6, y + 6);
    pdf.text('Servicios de software - Paquete Cyclon Plus [+]', margin + 20, y + 6);
    const formattedTotal = '$' + factura.total.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    pdf.text(formattedTotal, rightCol - 55, y + 6, { align: 'right' });
    pdf.text(formattedTotal, rightCol - 3, y + 6, { align: 'right' });

    // ===== RESUMEN DE TOTALES =====
    y += 16;
    const summaryX = pageW / 2 + 20;
    const valX = rightCol - 3;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Subtotal:', summaryX, y);
    pdf.text(formattedTotal, valX, y, { align: 'right' });

    this.dynamicColumns.forEach(column => {
      const value = factura[column];
      const operationType = factura['operationTypes']?.[column];
      const percentage = factura['percentages']?.[column];
      if (value !== undefined && value !== null && operationType) {
        y += 7;
        const label = this.getColumnLabel(column, factura);
        const sign = operationType === 'subtract' ? '(-) ' : '(+) ';
        const pctLabel = percentage ? ' (' + percentage + '%)' : '';
        pdf.text(sign + label + pctLabel + ':', summaryX, y);
        pdf.text('$' + Math.abs(value).toLocaleString('es-CO', { minimumFractionDigits: 2 }), valX, y, { align: 'right' });
      }
    });

    y += 5;
    pdf.setDrawColor(60, 60, 150);
    pdf.setLineWidth(0.5);
    pdf.line(summaryX, y, rightCol, y);

    y += 8;
    const totalFinal = this.calculateFinalTotal(factura);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL A PAGAR:', summaryX, y);
    pdf.text('$' + totalFinal.toLocaleString('es-CO', { minimumFractionDigits: 2 }), valX, y, { align: 'right' });

    y += 8;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'italic');
    pdf.text('SON: ' + this.numberToWords(Math.floor(totalFinal)).toUpperCase() + ' PESOS M/CTE', margin, y);

    // ===== OBSERVACIONES =====
    y += 12;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, rightCol, y);
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('OBSERVACIONES', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Actividad económica: 6201 - Actividades de desarrollo de sistemas informáticos.', margin, y);
    y += 5;
    pdf.text('Responsabilidad fiscal: Responsable de IVA - Agente de retención en la fuente.', margin, y);
    y += 5;
    pdf.text('Resolución de facturación DIAN No. 18764 del 2026-01-01. Rango autorizado: DF00001 a DF99999. Vigencia: 12 meses.', margin, y);

    // ===== INFORMACIÓN DE PAGO =====
    y += 12;
    pdf.setFillColor(240, 240, 250);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, pageW - margin * 2, 18, 'FD');
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMACIÓN DE PAGO', margin + 3, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Banco: Bancolombia  |  Cuenta de ahorros No. 039-000000-00  |  A nombre de: Cyclonet S. A. S.  |  NIT: 901.515.884-4', margin + 3, y);
    y += 5;
    pdf.text('Nequi / Daviplata: 314 414 4986', margin + 3, y);

    // ===== TÉRMINOS Y CONDICIONES =====
    y += 12;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TÉRMINOS Y CONDICIONES', margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text('1. Esta factura se asimila en todos sus efectos a una letra de cambio (Art. 774 del Código de Comercio).', margin, y);
    y += 4;
    pdf.text('2. El pago debe realizarse antes de la fecha de vencimiento. Pagos tardíos generan intereses de mora conforme a la ley.', margin, y);
    y += 4;
    pdf.text('3. La prestación del servicio podrá suspenderse si la factura no es cancelada dentro de los 30 días siguientes al vencimiento.', margin, y);
    y += 4;
    pdf.text('4. Para reclamaciones dispone de 3 días hábiles a partir de la recepción de esta factura.', margin, y);

    // ===== PIE DE PÁGINA =====
    const footerY = pageH - 15;
    pdf.setDrawColor(60, 60, 150);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 5, rightCol, footerY - 5);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Cyclonet S. A. S. | NIT: 901.515.884-4 | www.cyclonet.com.co | ti.cyclonet@hotmail.com', pageW / 2, footerY, { align: 'center' });
    pdf.text('Documento generado el ' + new Date().toLocaleDateString('es-CO') + ' - Representación gráfica de la factura electrónica.', pageW / 2, footerY + 4, { align: 'center' });
    pdf.setTextColor(0, 0, 0);

    pdf.save('Factura_' + factura.numero + '.pdf');
    this.showToast('Invoice PDF ' + factura.numero + ' generated', 'success', 'A', 0);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private calculateDaysBetween(startDate?: string, endDate?: string): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  private generatePDFWithoutLogo(pdf: jsPDF, factura: Factura): void {
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    this.buildInvoicePDF(pdf, factura, 15, pageW - 15, pageW, pageH, 10);
  }

  /**
   * Abre el dropdown de estados en la posición del elemento clickeado
   */
  openStatusDropdown(event: MouseEvent, invoiceId: number) {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.statusDropdownPosition.set({
      top: rect.top + window.scrollY - 200, // Posicionar por encima
      left: rect.left + window.scrollX
    });
    this.statusDropdownOpen.set(invoiceId.toString());
  }

  /**
   * Cierra el dropdown de estados
   */
  closeStatusDropdown() {
    this.statusDropdownOpen.set(null);
  }

  /**
   * Cambia el estado de la factura
   */
  changeInvoiceStatus(invoiceId: number, newStatus: string) {
    this.factonetService.updateInvoiceStatus(invoiceId, newStatus).subscribe({
      next: () => {
        // Actualizar la factura en la lista local
        this.facturas = this.facturas.map(factura => 
          factura.id === invoiceId 
            ? { ...factura, estado: newStatus as any }
            : factura
        );
        
        this.filteredFacturas = this.filteredFacturas.map(factura => 
          factura.id === invoiceId 
            ? { ...factura, estado: newStatus as any }
            : factura
        );
        
        this.updatePagination();
        this.showToast(`Status updated to ${newStatus}`, 'success', 'A', 0);
        this.closeStatusDropdown();
      },
      error: (error) => {
        this.showToast('Error updating invoice status', 'danger', 'A', 0);
        this.closeStatusDropdown();
      }
    });
  }

  payInvoice(factura: Factura) {
    // Calculate the current total (value + dynamic parameters)
    const baseValue = factura.total || 0;
    const lateFee = factura['late_fee_penalty'] || 0;
    const suggestedTotal = baseValue;

    Swal.fire({
      title: '',
      html: `
        <style>
          @media (max-width: 480px) {
            .swal-payment-grid { grid-template-columns: 1fr !important; }
            .swal-payment-header { padding: 18px 16px 14px 16px !important; }
            .swal-payment-summary { padding: 12px !important; }
            .swal-payment-upload { padding: 12px !important; }
          }
          .swal-payment-popup { padding-top: 0 !important; overflow: hidden; }
          .swal-payment-popup .swal2-html-container { padding: 0 !important; margin: 0 !important; }
          .swal-payment-popup .swal2-actions { margin-top: 0 !important; padding-bottom: 1.2em; }
        </style>
        <div style="text-align: left; font-size: 14px;">
          <!-- Gradient header -->
          <div class="swal-payment-header" style="background: linear-gradient(135deg, #0d1b4a 0%, #152057 50%, #1a2970 100%); color: white; padding: 28px 24px 20px 24px; margin-bottom: 0; border-radius: 5px 5px 0 0;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: rgba(255,255,255,0.15); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="22" height="22" fill="white" viewBox="0 0 16 16">
                  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H0zm0 3v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zm3 2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1"/>
                </svg>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 700;">Report Payment</h3>
                <p style="margin: 0; font-size: 12px; opacity: 0.85;">Attach proof of payment for verification</p>
              </div>
            </div>
          </div>

          <!-- Content with padding -->
          <div style="padding: 20px 24px 4px 24px;">
          <!-- Invoice summary -->
          <div class="swal-payment-summary" style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 10px; padding: 16px; margin-bottom: 18px; border: 1px solid #bbdefb;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center;">
              <span style="color: #5c6bc0; font-weight: 500;">📄 Invoice</span>
              <strong style="color: #1a237e; font-size: 15px;">${factura.numero || ''}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center;">
              <span style="color: #5c6bc0; font-weight: 500;">🏢 Client</span>
              <strong style="color: #1a237e;">${factura.cliente || ''}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; align-items: center;">
              <span style="color: #5c6bc0; font-weight: 500;">💰 Base Amount</span>
              <span style="color: #1a237e; font-weight: 600;">$${Number(factura.total || 0).toLocaleString('es-CO')}</span>
            </div>
            ${lateFee > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #fff3e0; padding: 6px 10px; border-radius: 6px; margin: 6px 0;">
              <span style="color: #e65100; font-weight: 500;">⚠️ Late Fee Penalty</span>
              <span style="color: #e65100; font-weight: 700;">$${Number(lateFee).toLocaleString('es-CO')}</span>
            </div>` : ''}
            <div style="border-top: 2px dashed #90caf9; margin: 10px 0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <span style="color: #0d1b4a; font-weight: 700; font-size: 15px;">Suggested Total</span>
              <span style="color: #0d1b4a; font-weight: 800; font-size: 18px; background: linear-gradient(135deg, #e8eaf6, #c5cae9); padding: 5px 14px; border-radius: 6px; border: 1px solid #7986cb;">$${Number(suggestedTotal + lateFee).toLocaleString('es-CO')}</span>
            </div>
          </div>

          <!-- Form fields -->
          <div class="swal-payment-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
              <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #37474f; font-size: 13px;">📅 Payment Date <span style="color: #e53935;">*</span></label>
              <input type="date" id="swal-payment-date" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.2s; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor='#5c6bc0'" onblur="this.style.borderColor='#e0e0e0'">
            </div>
            <div>
              <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #37474f; font-size: 13px;">💵 Amount Paid <span style="color: #e53935;">*</span></label>
              <input type="number" id="swal-paid-amount" value="${suggestedTotal + lateFee}" step="0.01" min="0" style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: border-color 0.2s; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor='#5c6bc0'" onblur="this.style.borderColor='#e0e0e0'">
            </div>
          </div>

          <!-- Voucher upload -->
          <div class="swal-payment-upload" style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border: 2px dashed #66bb6a; border-radius: 10px; padding: 16px; text-align: center; transition: background 0.2s;">
            <div style="margin-bottom: 8px;">
              <svg width="32" height="32" fill="#43a047" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
              </svg>
            </div>
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2e7d32; font-size: 13px;">Payment Proof <span style="color: #e53935;">*</span></label>
            <input type="file" id="swal-voucher-file" accept=".pdf,.jpg,.jpeg,.png,.webp" style="width: 100%; padding: 8px; border: none; background: white; border-radius: 6px; font-size: 13px; cursor: pointer;">
            <small style="color: #558b2f; display: block; margin-top: 6px; font-size: 11px;">PDF, JPG, PNG, WEBP — Max 5MB • <strong style="color: #c62828;">Required</strong></small>
          </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '✓ Report Payment',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2e7d32',
      cancelButtonColor: '#78909c',
      width: '520px',
      customClass: {
        popup: 'swal-payment-popup'
      },
      preConfirm: () => {
        const paymentDate = (document.getElementById('swal-payment-date') as HTMLInputElement).value;
        const paidAmount = parseFloat((document.getElementById('swal-paid-amount') as HTMLInputElement).value);
        const fileInput = document.getElementById('swal-voucher-file') as HTMLInputElement;
        const voucherFile = fileInput.files?.[0] || null;

        if (!paymentDate) {
          Swal.showValidationMessage('Payment date is required');
          return false;
        }
        if (!paidAmount || paidAmount <= 0) {
          Swal.showValidationMessage('Amount paid must be greater than 0');
          return false;
        }
        if (!voucherFile) {
          Swal.showValidationMessage('Payment proof is required');
          return false;
        }
        if (voucherFile.size > 5 * 1024 * 1024) {
          Swal.showValidationMessage('File cannot exceed 5MB');
          return false;
        }

        return { paymentDate, paidAmount, voucherFile };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { paymentDate, paidAmount, voucherFile } = result.value;

        this.factonetService.registerPayment(factura.id, paymentDate, paidAmount, voucherFile).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Payment Reported!',
              html: `
                <div style="font-size: 14px; text-align: center;">
                  <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 10px; padding: 16px; margin-bottom: 12px;">
                    <p style="margin: 0 0 6px 0; color: #2e7d32; font-weight: 600;">Invoice <strong>${factura.numero}</strong></p>
                    <p style="margin: 0 0 6px 0; color: #1b5e20;">Amount: <strong>$${paidAmount.toLocaleString('es-CO')}</strong></p>
                    <p style="margin: 0; color: #1b5e20;">Date: <strong>${paymentDate}</strong></p>
                  </div>
                  <div style="background: #e3f2fd; padding: 10px 16px; border-radius: 8px; border-left: 4px solid #1976d2;">
                    <p style="margin: 0; color: #1565c0; font-size: 12px;">⏳ <em>Pending verification by administrator.</em></p>
                  </div>
                </div>
              `,
              confirmButtonColor: '#1a237e',
              timer: 5000,
              showConfirmButton: true,
            });
            this.loadFacturas();
            this.invoiceRefreshService.triggerRefresh();
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Payment Registration Error',
              text: error.error?.message || 'Could not register the payment',
              confirmButtonColor: '#0d6efd',
            });
          }
        });
      }
    });
  }

  /**
   * View or download the payment voucher for a paid/reported invoice.
   * Admin (adminFactonet) sees approve/reject buttons for Payment Reported invoices.
   */
  viewPaymentVoucher(factura: Factura) {
    this.factonetService.getPaymentVoucher(factura.id).subscribe({
      next: (data) => {
        if (!data.voucherUrl) {
          Swal.fire({
            icon: 'info',
            title: 'No Proof Attached',
            text: `Invoice ${factura.numero} does not have a payment proof attached.`,
            confirmButtonColor: '#0d6efd',
          });
          return;
        }

        const voucherUrl = data.voucherUrl;
        const isPdf = voucherUrl.toLowerCase().includes('.pdf') || voucherUrl.toLowerCase().includes('/raw/');
        const isAdmin = this.userRol === 'adminFactonet';
        const isPendingVerification = factura.estado === 'Payment Reported';

        // Build download URL - for Cloudinary raw files, direct URL works
        const downloadUrl = voucherUrl;
        
        Swal.fire({
          title: 'Payment Proof',
          html: `
            <div style="text-align: left; font-size: 14px;">
              <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, #e3f2fd 0%, #ede7f6 100%); border-radius: 8px; border: 1px solid #bbdefb;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: #5c6bc0;">Invoice:</span>
                  <strong style="color: #1a237e;">${factura.numero}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: #5c6bc0;">Client:</span>
                  <strong style="color: #1a237e;">${factura.cliente}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: #5c6bc0;">Amount Paid:</span>
                  <strong style="color: #1b5e20;">$${Number(data.paidAmount || 0).toLocaleString('es-CO')}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #5c6bc0;">Payment Date:</span>
                  <strong style="color: #1a237e;">${data.paymentDate ? new Date(data.paymentDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong>
                </div>
                ${isPendingVerification ? `
                <div style="margin-top: 10px; padding: 8px 12px; background: linear-gradient(135deg, #fff8e1, #fff3e0); border-radius: 6px; color: #e65100; font-weight: 600; text-align: center; border: 1px solid #ffcc80;">
                  ⏳ Pending Verification
                </div>` : ''}
              </div>
              ${!isPdf ? `
                <div style="text-align: center; margin: 16px 0;">
                  <img src="${voucherUrl}" alt="Payment proof" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                </div>
              ` : `
                <div style="text-align: center; margin: 16px 0; padding: 24px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 10px;">
                  <svg width="48" height="48" fill="#2e7d32" viewBox="0 0 16 16">
                    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
                  </svg>
                  <p style="margin-top: 8px; color: #2e7d32; font-weight: 600;">PDF Document Attached</p>
                </div>
              `}
              <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
                <a href="${voucherUrl}" target="_blank" rel="noopener" style="padding: 8px 18px; text-decoration: none; border-radius: 6px; background: #e3f2fd; color: #1565c0; font-size: 13px; font-weight: 500;">
                  🔍 View Full Screen
                </a>
                <a href="${downloadUrl}" target="_blank" style="padding: 8px 18px; text-decoration: none; border-radius: 6px; background: #e8f5e9; color: #2e7d32; font-size: 13px; font-weight: 500;">
                  ⬇️ Download
                </a>
              </div>
            </div>
          `,
          width: '550px',
          showConfirmButton: isAdmin && isPendingVerification,
          confirmButtonText: '✓ Approve Payment',
          confirmButtonColor: '#2e7d32',
          showDenyButton: isAdmin && isPendingVerification,
          denyButtonText: '✗ Reject Payment',
          denyButtonColor: '#c62828',
          showCancelButton: true,
          cancelButtonText: 'Close',
        }).then((result) => {
          if (result.isConfirmed) {
            this.confirmPayment(factura);
          } else if (result.isDenied) {
            this.rejectPayment(factura);
          }
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Could not retrieve the payment proof.',
          confirmButtonColor: '#0d6efd',
        });
      }
    });
  }

  /**
   * Admin approves the payment after verifying the voucher
   */
  private confirmPayment(factura: Factura) {
    Swal.fire({
      title: 'Confirm Payment?',
      html: `<p>Approve payment for invoice <strong>${factura.numero}</strong>?</p><p>The invoice will be marked as <strong>Paid</strong>.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2e7d32',
    }).then((result) => {
      if (result.isConfirmed) {
        this.factonetService.confirmPayment(factura.id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Payment Approved!',
              text: `Invoice ${factura.numero} marked as paid.`,
              confirmButtonColor: '#1a237e',
              timer: 3000,
            });
            this.loadFacturas();
            this.invoiceRefreshService.triggerRefresh();
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || 'Could not confirm the payment.',
              confirmButtonColor: '#0d6efd',
            });
          }
        });
      }
    });
  }

  /**
   * Admin rejects the payment — prompts for a reason
   */
  private rejectPayment(factura: Factura) {
    Swal.fire({
      title: 'Reject Payment',
      html: `<p>Reject payment for invoice <strong>${factura.numero}</strong>?</p><p>The invoice will revert to <strong>Issued</strong> and the client may retry.</p>`,
      input: 'textarea',
      inputLabel: 'Rejection reason (optional)',
      inputPlaceholder: 'E.g.: Proof does not match, incorrect amount...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#c62828',
    }).then((result) => {
      if (result.isConfirmed) {
        const reason = result.value || '';
        this.factonetService.rejectPayment(factura.id, reason).subscribe({
          next: () => {
            Swal.fire({
              icon: 'info',
              title: 'Payment Rejected',
              text: `Payment for invoice ${factura.numero} has been rejected.`,
              confirmButtonColor: '#1a237e',
              timer: 3000,
            });
            this.loadFacturas();
            this.invoiceRefreshService.triggerRefresh();
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || 'Could not reject the payment.',
              confirmButtonColor: '#0d6efd',
            });
          }
        });
      }
    });
  }

  /**
   * Checks if any invoice has a rejection reason and shows notification to the client
   */
  private checkRejectedPayments() {
    const rejectedInvoices = this.facturas.filter(f => f.rejectionReason);
    if (rejectedInvoices.length > 0) {
      const invoiceList = rejectedInvoices.map(f => 
        `<div style="background: #fff3e0; border-left: 4px solid #e65100; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; text-align: left;">
          <strong style="color: #e65100;">${f.numero}</strong>
          <p style="margin: 4px 0 0 0; color: #bf360c; font-size: 13px;">${f.rejectionReason}</p>
        </div>`
      ).join('');

      Swal.fire({
        icon: 'warning',
        title: 'Payment Rejected',
        html: `
          <div style="font-size: 14px;">
            <p style="color: #333; margin-bottom: 12px;">The following invoice(s) had their payment rejected. Please submit a new payment with valid proof.</p>
            ${invoiceList}
          </div>
        `,
        confirmButtonText: 'Understood',
        confirmButtonColor: '#1a237e',
        width: '500px',
      });
    }
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