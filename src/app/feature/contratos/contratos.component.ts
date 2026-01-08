import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { ContractPdfService } from '../../shared/services/contract-pdf.service';
import { Contract } from '../../shared/model/contract.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

// Pipe personalizado para reemplazar
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'replace', standalone: true})
export class ReplacePipe implements PipeTransform {
  transform(value: string | null, search: string, replacement: string): string {
    if (!value) return '';
    return value.replace(new RegExp(search, 'g'), replacement);
  }
}

@Component({
  selector: 'app-contratos', 
  standalone: true,
  imports: [CommonModule, ReplacePipe],
  templateUrl: './contratos.component.html', 
  styleUrls: ['./contratos.component.css'] 
})
export class ContratosComponent implements OnInit, OnDestroy { 
  
  // Utilizamos signals para el estado reactivo
  contratos = signal<Contract[]>([]);
  selectedContrato = signal<Contract | null>(null); 
  
  // Bandera para el modal de creación/edición
  isModalOpen = signal(false);
  // Bandera para el modal de confirmación de eliminación (reemplazo de confirm())
  isDeleteConfirmationModalOpen = signal(false);

  // Configuración de notificaciones usando signals
  notifications = signal<Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B'; // A: temporal, B: persistente
    container: 0 | 1; // 0: top-right, 1: bottom-left
    visible: boolean;
  }>>([]);
  
  showOptions = true; // Controla la visibilidad del panel de opciones
  
  private clickListener?: () => void;

  // Propiedad para el contrato del modal
  modalContrato: Contract | null = null;
  
  // Controla la visibilidad de la información detallada del usuario
  showUserDetails = signal(false);
  
  // Controla la visibilidad de la información detallada del paquete
  showPackageDetails = signal(false);
  
  // Controla el estado de generación de PDF
  generatingPDF = signal(false);
  
  // Almacena los contratos que ya tienen PDF generado
  contractsWithPDF = new Set<string>();

  // Estados permitidos para contratos
  contractStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TERMINATED', 'RENEWED', 'DELETED'];
  
  // Control del dropdown de estados
  statusDropdownOpen = signal<string | null>(null);
  statusDropdownPosition = signal<{top: number, left: number}>({top: 0, left: 0});

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService,
    private contractPdfService: ContractPdfService
  ) { 
    // Las signals reemplazan la necesidad de inicializar arrays vacíos aquí
  }

  ngOnInit(): void {
    this.loadContratos();
    
    // Listener para cerrar dropdown al hacer click fuera
    this.clickListener = () => {
      this.closeStatusDropdown();
    };
    document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
    }
  }

  /**
   * Carga contratos desde el backend.
   */
  loadContratos(): void {
    this.factonetService.getContracts().subscribe({
      next: (contratos) => {
        // Ordenar contratos por fecha de inicio (más reciente primero)
        const contratosOrdenados = (contratos || []).sort((a, b) => {
          const dateA = new Date(a.startDate);
          const dateB = new Date(b.startDate);
          return dateB.getTime() - dateA.getTime();
        });
        
        this.contratos.set(contratosOrdenados);
        // Limpiar y actualizar contratos con PDF
        this.contractsWithPDF.clear();
        contratosOrdenados.forEach(contrato => {
          if (contrato.pdfUrl) {
            this.contractsWithPDF.add(contrato.id);
          }
        });
        if (contratosOrdenados.length > 0) {
          this.showToast('Contratos cargados correctamente', 'success', 'A', 0);
        } else {
          this.showToast('No hay contratos disponibles', 'primary', 'A', 0);
        }
      },
      error: (error) => {
        this.contratos.set([]);
        this.showToast('Error conectando con el servidor de contratos', 'danger', 'A', 0);
      }
    });
  }

  /**
   * Abre el modal para añadir un nuevo contrato.
   */
  openContratoModal() { 
    this.isModalOpen.set(true);
    this.showToast('SYSTEM: Opening Contract Creation Interface...', 'primary', 'A', 0);
  }

  /**
   * Muestra los detalles del contrato en el modal.
   */
  viewContrato(contrato: Contract) {
    this.modalContrato = contrato; // Usar propiedad normal en lugar de signal
    this.selectedContrato.set(contrato);
    this.showUserDetails.set(false); // Resetear al abrir modal
    this.showPackageDetails.set(false); // Resetear al abrir modal
    this.showToast(`Viewing contract: ${contrato.code || contrato.id}`, 'primary', 'A', 0);
    
    // Abrir modal programáticamente
    setTimeout(() => {
      const modal = document.getElementById('viewContractModal');
      if (modal) {
        const bootstrapModal = new (window as any).bootstrap.Modal(modal);
        bootstrapModal.show();
      }
    }, 100);
  }

  /**
   * Alterna la visibilidad de los detalles del usuario.
   */
  toggleUserDetails() {
    this.showUserDetails.update(current => !current);
  }

  /**
   * Alterna la visibilidad de los detalles del paquete.
   */
  togglePackageDetails() {
    this.showPackageDetails.update(current => !current);
  }

  /**
   * Genera y descarga el contrato en PDF.
   */
  generateContractPDF(contrato: Contract) {
    // Si ya existe el PDF en Cloudinary, mostrar opciones directamente
    if (contrato.pdfUrl) {
      this.showPDFOptions(contrato);
      return;
    }
    
    // Si no existe PDF, generarlo
    this.generatingPDF.set(true);
    
    Swal.fire({
      title: 'Generando PDF...',
      text: `Creando contrato para ${contrato.code || contrato.id}`,
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // Generar PDF y subirlo al servidor
    this.generateAndUploadPDF(contrato).then(() => {
      this.generatingPDF.set(false);
      // Recargar contratos para obtener la URL actualizada
      this.loadContratos();
      // Mostrar opciones con el contrato actualizado
      setTimeout(() => {
        const contratoActualizado = this.contratos().find(c => c.id === contrato.id);
        if (contratoActualizado) {
          this.showPDFOptions(contratoActualizado);
        }
      }, 1000);
    }).catch(error => {
      this.generatingPDF.set(false);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo generar el PDF',
        icon: 'error'
      });
    });
  }

  /**
   * Muestra las opciones disponibles para el PDF.
   */
  private showPDFOptions(contrato: Contract) {
    Swal.fire({
      title: 'PDF Available!',
      text: `Contract ${contrato.code || contrato.id} ready`,
      icon: 'success',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'View PDF',
      denyButtonText: 'Download',
      cancelButtonText: 'Close'
    }).then((result) => {
      if (result.isConfirmed) {
        // Siempre usar modal HTML local
        this.viewContractPDF(contrato);
      } else if (result.isDenied) {
        this.downloadContractPDF(contrato);
      }
    });
  }

  /**
   * Muestra el contrato PDF en un modal.
   */
  private viewContractPDF(contrato: Contract) {
    const contractContent = this.generateContractHTML(contrato);
    
    Swal.fire({
      title: `Contrato ${contrato.code || contrato.id}`,
      html: contractContent,
      width: '80%',
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'contract-modal'
      }
    });
  }

  /**
   * Genera el contenido HTML del contrato.
   */
  private generateContractHTML(contrato: Contract): string {
    const clientName = contrato.user.basicData?.legalEntityData?.businessName || 
                      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() ||
                      contrato.user.strUserName;
    
    const documentInfo = contrato.user.basicData?.documentType && contrato.user.basicData?.documentNumber 
      ? `<strong>Documento:</strong> ${contrato.user.basicData.documentType.description} ${contrato.user.basicData.documentNumber}<br>`
      : '';
    
    const contactInfo = contrato.user.basicData?.legalEntityData ? `
      <strong>Representante Legal:</strong> ${contrato.user.basicData.legalEntityData.contactName}<br>
      <strong>Email:</strong> ${contrato.user.basicData.legalEntityData.contactEmail}<br>
      <strong>Teléfono:</strong> ${contrato.user.basicData.legalEntityData.contactPhone}<br>
      ${contrato.user.basicData.legalEntityData.webSite ? `<strong>Sitio Web:</strong> ${contrato.user.basicData.legalEntityData.webSite}<br>` : ''}
    ` : `<strong>Email:</strong> ${contrato.user.strUserName}<br>`;

    const configurations = contrato.package.configurations?.map(config => 
      `• ${config.totalAccount} cuentas ${config.rol.strName} a ${this.formatCurrency(config.price)} c/u`
    ).join('<br>') || 'No disponible';

    return `
      <div style="text-align: center; margin-bottom: 40px;">
        <img src="assets/img/Cyclonet_nit.png" alt="Cyclonet Logo" style="max-width: 280px; height: auto; margin-bottom: 30px;">
      </div>
      <h3 style="text-align: center; margin-bottom: 30px;">CONTRATO DE PRESTACIÓN DE SERVICIOS SAAS</h3>
      
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <h4 style="color: #2c3e50; margin-bottom: 15px;">PROVEEDOR:</h4>
        <p><strong>Cyclonet S. A. S.</strong><br>
        NIT: 901515884-4<br>
        Dirección: Bonanza, Mz 23 Lt 30 (Turbaco - Bolívar)<br>
        Teléfono: 314 414 4986 - 321 898 5475<br>
        Email: ti.cyclonet@hotmail.com<br>
        Sitio web: https://www.cyclonet.com.co/</p>
      </div>
      
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f0f8ff;">
        <h4 style="color: #2c3e50; margin-bottom: 15px;">CLIENTE:</h4>
        <p><strong>${clientName}</strong><br>
        ${documentInfo}
        ${contactInfo}</p>
      </div>
      
      <h4>1. OBJETO DEL CONTRATO</h4>
      <p>Prestación de servicios SaaS "${contrato.package.name}"<br>
      <strong>Descripción:</strong> ${contrato.package.description}<br>
      <strong>Configuración:</strong><br>${configurations}</p>
      
      <h4>2. VALOR Y FORMA DE PAGO</h4>
      <p><strong>Valor total:</strong> ${this.formatCurrency(contrato.value)} (${this.numberToWords(typeof contrato.value === 'string' ? parseFloat(contrato.value) : contrato.value)} pesos)<br>
      <strong>Modalidad:</strong> ${contrato.mode}<br>
      ${contrato.payday ? `<strong>Día de pago:</strong> ${contrato.payday}<br>` : ''}</p>
      
      <h4>3. VIGENCIA</h4>
      <p><strong>Fecha de inicio:</strong> ${contrato.startDate}<br>
      <strong>Fecha de finalización:</strong> ${contrato.endDate}<br>
      <strong>Estado:</strong> ${contrato.status}</p>
      
      <h4>4. OBLIGACIONES DEL PROVEEDOR</h4>
      <p>• Garantizar disponibilidad del servicio 24/7<br>
      • Proporcionar soporte técnico<br>
      • Mantener seguridad y confidencialidad de datos</p>
      
      <h4>5. OBLIGACIONES DEL CLIENTE</h4>
      <p>• Realizar pagos en fechas acordadas<br>
      • Usar el servicio conforme a términos establecidos<br>
      • No compartir credenciales con terceros</p>
    `;
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

  /**
   * Formatea valores monetarios al formato colombiano.
   */
  private formatCurrency(value: string | number): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return '$' + numValue.toLocaleString('es-CO') + ',oo';
  }

  /**
   * Genera el PDF y lo sube al servidor.
   */
  private async generateAndUploadPDF(contrato: Contract): Promise<void> {
    const pdf = new jsPDF();
    
    // Título principal centrado
    pdf.setTextColor(0, 100, 200);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Contrato de prestación de servicios¹', 105, 30, { align: 'center' });
    
    // Fecha de actualización en rojo
    pdf.setTextColor(255, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const fechaActual = new Date().toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    pdf.text(`(Fecha de actualización: ${fechaActual})`, 20, 45);
    
    // Contenido del contrato en negro
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    const clientName = contrato.user.basicData?.legalEntityData?.businessName || 
                      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() ||
                      contrato.user.strUserName;
    
    // Párrafo de identificación de las partes
    const textoPartes = `(${clientName}), mayor de edad, identificado(a) con cédula de ciudadanía (número de cédula), actuando en nombre propio o como representante legal de un ente jurídico, en este último caso, indicar razón social y NIT), quien en adelante se denominará CONTRATANTE, y (Cyclonet S.A.S.), mayor de edad, identificado(a) con cédula de ciudadanía (901515884-4), domiciliado(a) en (Turbaco - Bolívar), quien para los efectos del presente documento se denominará CONTRATISTA, acuerdan celebrar el presente CONTRATO DE PRESTACIÓN DE SERVICIOS, el cual se regirá por las siguientes cláusulas:`;
    
    const lineasPartes = pdf.splitTextToSize(textoPartes, 170);
    pdf.text(lineasPartes, 20, 60);
    
    let yPos = 60 + (lineasPartes.length * 5) + 15;
    
    // Primera cláusula - Objeto
    pdf.setFont('helvetica', 'bold');
    pdf.text('Primera – Objeto:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    
    const textoObjeto = `el (la) CONTRATISTA, en su calidad de trabajador(a) independiente, se obliga para con el (la) CONTRATANTE a ejecutar los trabajos y demás actividades propias del servicio contratado, el cual debe realizar de conformidad con las condiciones y cláusulas del presente documento, el cual consistirá en: (${contrato.package.name} - ${contrato.package.description || 'Servicio de software'}), sin que exista horario determinado ni dependencia².`;
    
    const lineasObjeto = pdf.splitTextToSize(textoObjeto, 170);
    pdf.text(lineasObjeto, 20, yPos + 8);
    
    yPos += 8 + (lineasObjeto.length * 5) + 10;
    
    // Segunda cláusula - Duración
    pdf.setFont('helvetica', 'bold');
    pdf.text('Segunda – Duración o plazo:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    
    const textoDuracion = `el plazo para la ejecución del presente contrato será de (un año), contados a partir de (${contrato.startDate}), y podrá prorrogarse por acuerdo entre las partes, con vencimiento el (${contrato.endDate}).`;
    
    const lineasDuracion = pdf.splitTextToSize(textoDuracion, 170);
    pdf.text(lineasDuracion, 20, yPos + 8);
    
    yPos += 8 + (lineasDuracion.length * 5) + 10;
    
    // Tercera cláusula - Valor
    pdf.setFont('helvetica', 'bold');
    pdf.text('Tercera – Valor:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    
    const valorFormateado = this.formatCurrency(contrato.value);
    const valorNumerico = typeof contrato.value === 'string' ? parseFloat(contrato.value) : contrato.value;
    const valorEnLetras = this.numberToWords(valorNumerico);
    const textoValor = `el valor del presente contrato es de ${valorFormateado} (${valorEnLetras} pesos), el cual será cancelado de la siguiente manera: (especificar forma de pago y periodicidad).`;
    
    const lineasValor = pdf.splitTextToSize(textoValor, 170);
    pdf.text(lineasValor, 20, yPos + 8);
    
    yPos += 8 + (lineasValor.length * 5) + 10;
    
    // Configuraciones del paquete si existen
    if (contrato.package.configurations && contrato.package.configurations.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Configuración del servicio:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      yPos += 8;
      contrato.package.configurations.forEach((config) => {
        pdf.text(`• ${config.totalAccount} cuentas ${config.rol.strName} - ${this.formatCurrency(config.price)} c/u`, 25, yPos);
        yPos += 6;
      });
    }
    
    // Convertir a buffer y subir
    const pdfBuffer = pdf.output('arraybuffer');
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    return new Promise((resolve, reject) => {
      this.contractPdfService.uploadContractPDF(contrato.id, base64PDF).subscribe({
        next: (result) => {
          console.log('PDF subido exitosamente:', result.pdfUrl);
          resolve();
        },
        error: (error) => {
          console.error('Error subiendo PDF:', error);
          reject(error);
        }
      });
    });
  }

  private downloadContractPDF(contrato: Contract) {
    const pdf = new jsPDF();
    
    const logoImg = new Image();
    logoImg.onload = () => {
      this.generatePDFContent(pdf, contrato, logoImg);
      pdf.save(`Contrato_${contrato.code || contrato.id}.pdf`);
    };
    
    logoImg.src = 'assets/img/Cyclonet_nit.png';
  }

  /**
   * Genera el contenido del PDF (extraído para reutilización).
   */
  private generatePDFContent(pdf: jsPDF, contrato: Contract, logoImg: HTMLImageElement): void {
    // Logo más grande
    const logoWidth = 60;
    const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
    const logoX = (pdf.internal.pageSize.getWidth() - logoWidth) / 2;
    
    pdf.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
    
    // Título más compacto
    pdf.setFontSize(12);
    pdf.text('CONTRATO DE PRESTACIÓN DE SERVICIOS SAAS', 20, logoHeight + 20);
    
    pdf.setFontSize(10);
    pdf.text(`CONTRATO No. ${contrato.code || contrato.id}`, 20, logoHeight + 30);
    
    let yPosition = logoHeight + 40;
    
    // Proveedor - más compacto
    pdf.setFontSize(9);
    pdf.text('PROVEEDOR: Cyclonet S.A.S. - NIT: 901515884-4', 20, yPosition);
    pdf.text('Dir: Bonanza, Mz 23 Lt 30 (Turbaco-Bolívar) - Tel: 314 414 4986', 20, yPosition + 8);
    pdf.text('Email: ti.cyclonet@hotmail.com - Web: https://www.cyclonet.com.co/', 20, yPosition + 16);
    
    yPosition += 30;
    
    // Cliente - más compacto (sin línea)
    const clientName = contrato.user.basicData?.legalEntityData?.businessName || 
                      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() ||
                      contrato.user.strUserName;
    
    const documentInfo = contrato.user.basicData?.documentType && contrato.user.basicData?.documentNumber 
      ? `${contrato.user.basicData.documentType.description}: ${contrato.user.basicData.documentNumber}`
      : 'Documento: No especificado';
    
    pdf.text(`CLIENTE: ${clientName} - ${documentInfo}`, 20, yPosition);
    pdf.text(`Email: ${contrato.user.strUserName}`, 20, yPosition + 8);
    
    if (contrato.user.basicData?.legalEntityData) {
      pdf.text(`Rep: ${contrato.user.basicData.legalEntityData.contactName} - Tel: ${contrato.user.basicData.legalEntityData.contactPhone}`, 20, yPosition + 16);
      yPosition += 8;
    }
    
    yPosition += 25;
    
    // Contenido del contrato - más compacto (sin línea)
    pdf.setFontSize(8);
    pdf.text('1. OBJETO: Prestación de servicios SaaS', 20, yPosition);
    pdf.text(`Servicio: ${contrato.package.name} - ${contrato.package.description || 'Sin descripción'}`, 20, yPosition + 8);
    
    yPosition += 20;
    const valorNumerico = typeof contrato.value === 'string' ? parseFloat(contrato.value) : contrato.value;
    const valorEnLetras = this.numberToWords(valorNumerico);
    pdf.text(`2. VALOR: ${this.formatCurrency(contrato.value)} (${valorEnLetras} pesos) - Modalidad: ${contrato.mode}${contrato.payday ? ` - Día pago: ${contrato.payday}` : ''}`, 20, yPosition);
    
    yPosition += 12;
    pdf.text(`3. VIGENCIA: ${contrato.startDate} al ${contrato.endDate}`, 20, yPosition);
    
    yPosition += 15;
    pdf.text('4. OBLIGACIONES DEL PROVEEDOR:', 20, yPosition);
    pdf.text('• Garantizar disponibilidad 24/7 • Soporte técnico • Seguridad de datos', 20, yPosition + 8);
    
    yPosition += 20;
    pdf.text('5. OBLIGACIONES DEL CLIENTE:', 20, yPosition);
    pdf.text('• Pagos puntuales • Uso conforme a términos • No compartir credenciales', 20, yPosition + 8);
    
    yPosition += 25;
    pdf.text('FIRMAS:', 20, yPosition);
    pdf.text('_____________________', 20, yPosition + 15);
    pdf.text('CYCLONET S.A.S.', 20, yPosition + 22);
    
    pdf.text('_____________________', 120, yPosition + 15);
    pdf.text('CLIENTE', 120, yPosition + 22);
  }

  /**
   * Establece el contrato seleccionado o lo deselecciona.
   */
  setSelectedContrato(contrato: Contract) { 
    if (this.selectedContrato() === contrato) {
        this.selectedContrato.set(null);
    } else {
      this.selectedContrato.set(contrato);
      this.showToast(`RECORD SELECTED: ${contrato.id}`, 'success', 'A', 0);
    }
  }

  /**
   * Abre el modal de confirmación de eliminación (reemplazo de confirm()).
   * Esta función debe ser llamada por el botón "Eliminar".
   */
  openDeleteConfirmationModal() {
    if (this.selectedContrato()) {
        this.isDeleteConfirmationModalOpen.set(true);
    } else {
        this.showToast('ERROR: No record selected for deletion.', 'warning', 'A', 0);
    }
  }

  /**
   * Cierra el modal de confirmación.
   */
  cancelDelete() {
    this.isDeleteConfirmationModalOpen.set(false);
  }

  /**
   * Ejecuta la eliminación del contrato seleccionado.
   * Esta función debe ser llamada por el botón "Confirmar" dentro del modal.
   */
  deleteContrato() { 
    const contrato = this.selectedContrato();
    if (contrato) {
        const idToDelete = contrato.id;
        
        // Actualiza el signal 'contratos' filtrando el elemento
        this.contratos.update(currentContratos => 
          currentContratos.filter(c => c.id !== idToDelete)
        );
        
        this.showToast(`RECORD ${idToDelete} DELETED successfully (Local Simulation).`, 'danger', 'A', 0);
        this.selectedContrato.set(null);
        this.isDeleteConfirmationModalOpen.set(false); // Cierra el modal
    } else {
      this.showToast('ERROR: No record selected for deletion.', 'warning', 'A', 0);
    }
  }

  /**
   * Función trackBy para optimización.
   */
  trackById(index: number, contrato: Contract): string { 
    return contrato.id;
  }

  // --- Funciones de Notificación ---

  /**
   * Elimina una notificación por índice.
   */
  removeNotification(index: number) {
    // Actualiza el signal 'notifications' eliminando el elemento por índice
    this.notifications.update(currentNotifications => {
        currentNotifications.splice(index, 1);
        return [...currentNotifications];
    });
  }

  /**
   * Muestra una notificación temporal (A) o persistente (B).
   */
  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
    const notification = {
      title: message,
      type,
      alertType,
      container,
      visible: true
    };
    
    // Agrega la notificación al array de signals
    this.notifications.update(currentNotifications => [...currentNotifications, notification]);

    if (alertType === 'A') {
      // Configura la eliminación automática después de 5 segundos
      setTimeout(() => {
        this.notifications.update(currentNotifications => 
            currentNotifications.filter(n => n !== notification)
        );
      }, 5000);
    }
  }

  /**
   * Abre el dropdown de estados en la posición del elemento clickeado
   */
  openStatusDropdown(event: MouseEvent, contractId: string) {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.statusDropdownPosition.set({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX
    });
    this.statusDropdownOpen.set(contractId);
  }

  /**
   * Cierra el dropdown de estados
   */
  closeStatusDropdown() {
    this.statusDropdownOpen.set(null);
  }

  /**
   * Cambia el estado del contrato
   */
  changeContractStatus(contractId: string, newStatus: string) {
    // Si es activación, validar primero
    if (newStatus === 'ACTIVE') {
      const contract = this.contratos().find(c => c.id === contractId);
      if (contract) {
        // Validar PDF
        if (!contract.pdfUrl || contract.pdfUrl.trim() === '') {
          Swal.fire({
            title: 'Cannot activate contract',
            text: 'You must generate the contract PDF before activating it.',
            icon: 'warning',
            confirmButtonText: 'Understood'
          });
          this.closeStatusDropdown();
          return;
        }
        
        // Validar confirmación de contrato firmado
        Swal.fire({
          title: 'Contract Confirmation',
          text: 'Has the user reviewed, accepted and signed the contract?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, signed',
          cancelButtonText: 'No, not yet',
          reverseButtons: true
        }).then((result) => {
          if (!result.isConfirmed) {
            Swal.fire({
              title: 'Cannot activate contract',
              text: 'The contract cannot be activated until the user has reviewed, accepted and signed it.',
              icon: 'warning',
              confirmButtonText: 'Understood'
            });
            this.closeStatusDropdown();
            return;
          }
          
          // Si confirma, proceder con la activación
          this.proceedWithActivation(contractId, newStatus);
        });
        
        return; // Salir aquí para evitar ejecutar el código de abajo
      }
    }
    
    // Para otros estados que no sean ACTIVE
    this.proceedWithActivation(contractId, newStatus);
  }
  
  /**
   * Procede con la activación del contrato después de las validaciones
   */
  private proceedWithActivation(contractId: string, newStatus: string) {
    // Mostrar spinner solo para activación
    if (newStatus === 'ACTIVE') {
      Swal.fire({
        title: 'Activating contract...',
        text: 'Validating requirements and activating the contract',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    }
    
    this.factonetService.updateContractStatus(contractId, newStatus).subscribe({
      next: () => {
        // Actualizar el contrato en la lista local
        this.contratos.update(contracts => 
          contracts.map(contract => 
            contract.id === contractId 
              ? { ...contract, status: newStatus }
              : contract
          )
        );
        
        if (newStatus === 'ACTIVE') {
          Swal.fire({
            title: 'Activated!',
            text: 'The contract has been successfully activated.',
            icon: 'success',
            confirmButtonText: 'OK'
          });
        } else {
          this.showToast(`Estado actualizado a ${newStatus}`, 'success', 'A', 0);
        }
        this.closeStatusDropdown();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Error al actualizar el estado';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error',
          confirmButtonText: 'OK'
        });
        this.closeStatusDropdown();
        console.error('Error updating contract status:', error);
      }
    });
  }
}