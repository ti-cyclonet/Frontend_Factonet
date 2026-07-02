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
  estado: 'Unconfirmed' | 'Issued' | 'In arrears' | 'Notification1' | 'Notification2' | 'Suspended' | 'Paid';
  operationTypes?: Record<string, string>;
  percentages?: Record<string, number>;
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
  invoiceStatuses = ['Unconfirmed', 'Issued', 'In arrears', 'Notification1', 'Notification2', 'Suspended', 'Paid'];
  
  // Control del dropdown de estados
  statusDropdownOpen = signal<string | null>(null);
  statusDropdownPosition = signal<{top: number, left: number}>({top: 0, left: 0});

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
      },
      error: (error) => {
        console.error('Error cargando facturas:', error);
        this.facturas = [];
        this.dynamicColumns = [];
        this.showToast('Error connecting to Authoriza Backend', 'danger', 'A', 0);
      }
    });
  }

  private detectDynamicColumns(): void {
    this.dynamicColumns = [];
    
    if (this.facturas.length > 0) {
      // Buscar todas las propiedades que no son campos base en TODAS las facturas
      const baseFields = ['id', 'numero', 'cliente', 'fechaEmision', 'fechaVencimiento', 'fechaPago', 'total', 'estado', 'operationTypes', 'percentages',
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

  sweepInvoices(): void {
    this.factonetService.sweepInvoices().subscribe({
      next: (result) => {
        this.showToast(`Sweep completed: ${result.generated} invoices generated`, 'success', 'A', 0);
        this.loadFacturas(); // Recargar la lista
        this.invoiceRefreshService.triggerRefresh(); // Notificar a header y footer
      },
      error: (error) => {

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
    pdf.text(this.formatDate(factura.periodoInicio || '') + ' a ' + this.formatDate(factura.periodoFin || ''), margin + 40, y);
    const estadoLabel: Record<string, string> = { 'Unconfirmed': 'Sin confirmar', 'Issued': 'Emitida', 'In arrears': 'En mora', 'Paid': 'Pagada', 'Suspended': 'Suspendida', 'Notification1': 'Notificación 1', 'Notification2': 'Notificación 2' };
    pdf.setFont('helvetica', 'bold');
    pdf.text('Estado:', col2X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(estadoLabel[factura.estado] || factura.estado, col2X + 16, y);

    // ===== DATOS DEL CLIENTE =====
    y += 10;
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(240, 240, 250);
    pdf.rect(margin, y, pageW - margin * 2, 24, 'FD');
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
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', col2X + 40, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.clienteEmailContacto || factura.clienteEmail || 'N/A', col2X + 54, y);

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
    Swal.fire({
      title: 'Feature Under Construction',
      text: 'The payment functionality is currently under development.',
      icon: 'info',
      confirmButtonText: 'OK'
    });
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