import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { InvoiceRefreshService } from '../../shared/services/invoice-refresh.service';
import jsPDF from 'jspdf';

interface Factura {
  id: number;
  numero: string;
  cliente: string;
  fechaEmision: string;
  fechaVencimiento: string;
  total: number;
  estado: 'Unconfirmed' | 'Issued' | 'In arrears' | 'Notification1' | 'Notification2' | 'Suspended' | 'Paid';
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
        this.facturas = (facturas || []).map(factura => {
          // Normalizar el estado del backend
          let estado = factura.status || 'Unconfirmed';
          if (estado === 'unconfirmed') estado = 'Unconfirmed';
          if (estado === 'issued') estado = 'Issued';
          if (estado === 'in arrears') estado = 'In arrears';
          if (estado === 'notification1') estado = 'Notification1';
          if (estado === 'notification2') estado = 'Notification2';
          if (estado === 'suspended') estado = 'Suspended';
          if (estado === 'paid') estado = 'Paid';
          if (estado === 'Pendiente') estado = 'Unconfirmed'; // Mapear estado legacy
          
          return {
            id: factura.id,
            numero: factura.code,
            cliente: factura.user?.basicData?.legalEntityData?.businessName || factura.user?.strUserName || 'N/A',
            fechaEmision: factura.issueDate,
            fechaVencimiento: factura.expirationDate,
            total: parseFloat(factura.value) || 0,
            estado,
            operationTypes: factura.operationTypes,
            percentages: factura.percentages,
            ...factura.globalParameters // Spread de parámetros dinámicos
          };
        });
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
    
    // Logo de la empresa
    const logoImg = new Image();
    logoImg.onload = () => {
      // Logo centrado
      const logoWidth = 70;
      const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
      const logoX = (pdf.internal.pageSize.getWidth() - logoWidth) / 2;
      pdf.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
      
      // Información de la empresa
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Cyclonet S. A. S.', 105, logoHeight + 25, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('NIT: 901515884-4', 105, logoHeight + 35, { align: 'center' });
      pdf.text('Bonanza, Mz 23 Lt 30 (Turbaco - Bolívar)', 105, logoHeight + 42, { align: 'center' });
      pdf.text('Tel: 314 414 4986 - 321 898 5475', 105, logoHeight + 49, { align: 'center' });
      pdf.text('ti.cyclonet@hotmail.com', 105, logoHeight + 56, { align: 'center' });
      
      // Título de la factura
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FACTURA DE VENTA', 105, logoHeight + 75, { align: 'center' });
      
      // Información de la factura
      let yPos = logoHeight + 95;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      // Número y fecha
      pdf.text(`Factura No: ${factura.numero}`, 20, yPos);
      pdf.text(`Fecha de emisión: ${factura.fechaEmision}`, 20, yPos + 8);
      pdf.text(`Fecha de vencimiento: ${factura.fechaVencimiento}`, 20, yPos + 16);
      pdf.text(`Estado: ${factura.estado}`, 20, yPos + 24);
      
      // Cliente
      yPos += 40;
      pdf.setFont('helvetica', 'bold');
      pdf.text('FACTURAR A:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(factura.cliente, 20, yPos + 8);
      
      // Tabla de conceptos
      yPos += 30;
      pdf.setFont('helvetica', 'bold');
      pdf.text('CONCEPTO', 20, yPos);
      pdf.text('VALOR', 150, yPos);
      
      // Línea separadora
      pdf.line(20, yPos + 3, 190, yPos + 3);
      
      yPos += 15;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Servicios de software', 20, yPos);
      pdf.text(`$${factura.total.toLocaleString('es-CO')}`, 150, yPos);
      
      // Conceptos dinámicos
      this.dynamicColumns.forEach(column => {
        const value = factura[column];
        const operationType = factura['operationTypes']?.[column];
        
        if (value && operationType) {
          yPos += 10;
          const label = this.getColumnLabel(column, factura);
          const sign = operationType === 'subtract' ? '-' : '+';
          pdf.text(`${label}`, 20, yPos);
          pdf.text(`${sign}$${value.toLocaleString('es-CO')}`, 150, yPos);
        }
      });
      
      // Total final
      yPos += 20;
      pdf.line(140, yPos - 5, 190, yPos - 5);
      pdf.setFont('helvetica', 'bold');
      const totalFinal = this.calculateFinalTotal(factura);
      pdf.text('TOTAL:', 140, yPos);
      pdf.text(`$${totalFinal.toLocaleString('es-CO')}`, 150, yPos);
      
      // Valor en letras mayúsculas
      yPos += 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const valorEnLetras = this.numberToWords(totalFinal).toUpperCase();
      pdf.text(`SON: ${valorEnLetras} PESOS`, 20, yPos);
      
      // Términos y condiciones
      yPos += 30;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Términos y condiciones:', 20, yPos);
      pdf.text('• Esta factura debe ser pagada en la fecha de vencimiento indicada.', 20, yPos + 8);
      pdf.text('• Los pagos tardíos pueden generar intereses de mora.', 20, yPos + 16);
      pdf.text('• Para cualquier consulta, contacte a nuestro departamento de facturación.', 20, yPos + 24);
      
      // Descargar PDF
      pdf.save(`Factura_${factura.numero}.pdf`);
      this.showToast(`PDF for invoice ${factura.numero} generated`, 'success', 'A', 0);
    };
    
    logoImg.onerror = () => {
      // Si no se puede cargar el logo, generar PDF sin logo
      this.generatePDFWithoutLogo(pdf, factura);
    };
    
    logoImg.src = 'assets/img/Cyclonet_nit.png';
  }
  
  private generatePDFWithoutLogo(pdf: jsPDF, factura: Factura): void {
    // Información de la empresa sin logo
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cyclonet S. A. S.', 105, 20, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('NIT: 901515884-4', 105, 30, { align: 'center' });
    pdf.text('Bonanza, Mz 23 Lt 30 (Turbaco - Bolívar)', 105, 37, { align: 'center' });
    pdf.text('Tel: 314 414 4986 - 321 898 5475', 105, 44, { align: 'center' });
    pdf.text('ti.cyclonet@hotmail.com', 105, 51, { align: 'center' });
    
    // Título de la factura
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FACTURA DE VENTA', 105, 70, { align: 'center' });
    
    // Información de la factura
    let yPos = 90;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    // Número y fecha
    pdf.text(`Factura No: ${factura.numero}`, 20, yPos);
    pdf.text(`Fecha de emisión: ${factura.fechaEmision}`, 20, yPos + 8);
    pdf.text(`Fecha de vencimiento: ${factura.fechaVencimiento}`, 20, yPos + 16);
    pdf.text(`Estado: ${factura.estado}`, 20, yPos + 24);
    
    // Cliente
    yPos += 40;
    pdf.setFont('helvetica', 'bold');
    pdf.text('FACTURAR A:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(factura.cliente, 20, yPos + 8);
    
    // Tabla de conceptos
    yPos += 30;
    pdf.setFont('helvetica', 'bold');
    pdf.text('CONCEPTO', 20, yPos);
    pdf.text('VALOR', 150, yPos);
    
    // Línea separadora
    pdf.line(20, yPos + 3, 190, yPos + 3);
    
    yPos += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Servicios de software', 20, yPos);
    pdf.text(`$${factura.total.toLocaleString('es-CO')}`, 150, yPos);
    
    // Conceptos dinámicos
    this.dynamicColumns.forEach(column => {
      const value = factura[column];
      const operationType = factura['operationTypes']?.[column];
      
      if (value && operationType) {
        yPos += 10;
        const label = this.getColumnLabel(column, factura);
        const sign = operationType === 'subtract' ? '-' : '+';
        pdf.text(`${label}`, 20, yPos);
        pdf.text(`${sign}$${value.toLocaleString('es-CO')}`, 150, yPos);
      }
    });
    
    // Total final
    yPos += 20;
    pdf.line(140, yPos - 5, 190, yPos - 5);
    pdf.setFont('helvetica', 'bold');
    const totalFinal = this.calculateFinalTotal(factura);
    pdf.text('TOTAL:', 140, yPos);
    pdf.text(`$${totalFinal.toLocaleString('es-CO')}`, 150, yPos);
    
    // Valor en letras mayúsculas
    yPos += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const valorEnLetras = this.numberToWords(totalFinal).toUpperCase();
    pdf.text(`SON: ${valorEnLetras} PESOS`, 20, yPos);
    
    // Términos y condiciones
    yPos += 30;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Términos y condiciones:', 20, yPos);
    pdf.text('• Esta factura debe ser pagada en la fecha de vencimiento indicada.', 20, yPos + 8);
    pdf.text('• Los pagos tardíos pueden generar intereses de mora.', 20, yPos + 16);
    pdf.text('• Para cualquier consulta, contacte a nuestro departamento de facturación.', 20, yPos + 24);
    
    // Descargar PDF
    pdf.save(`Factura_${factura.numero}.pdf`);
    this.showToast(`PDF for invoice ${factura.numero} generated`, 'success', 'A', 0);
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