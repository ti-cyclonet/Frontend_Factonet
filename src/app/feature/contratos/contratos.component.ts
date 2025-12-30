import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
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
export class ContratosComponent implements OnInit { 
  
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

  constructor(
    private cdr: ChangeDetectorRef,
    private factonetService: FactonetService,
    private contractPdfService: ContractPdfService
  ) { 
    // Las signals reemplazan la necesidad de inicializar arrays vacíos aquí
  }

  ngOnInit(): void {
    this.loadContratos();
  }

  /**
    * Carga contratos desde el backend.
    */
  loadContratos(): void {
    this.factonetService.getContracts().subscribe({
      next: (contratos) => {
        this.contratos.set(contratos || []);
        // Limpiar y actualizar contratos con PDF
        this.contractsWithPDF.clear();
        contratos?.forEach(contrato => {
          if (contrato.pdfUrl) {
            this.contractsWithPDF.add(contrato.id);
          }
        });
        if (contratos && contratos.length > 0) {
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
      title: '¡PDF Disponible!',
      text: `Contrato ${contrato.code || contrato.id} listo`,
      icon: 'success',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Ver PDF',
      denyButtonText: 'Descargar',
      cancelButtonText: 'Cerrar'
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
    
    const contactInfo = contrato.user.basicData?.legalEntityData ? `
      <strong>Representante Legal:</strong> ${contrato.user.basicData.legalEntityData.contactName}<br>
      <strong>Email:</strong> ${contrato.user.basicData.legalEntityData.contactEmail}<br>
      <strong>Teléfono:</strong> ${contrato.user.basicData.legalEntityData.contactPhone}<br>
      ${contrato.user.basicData.legalEntityData.webSite ? `<strong>Sitio Web:</strong> ${contrato.user.basicData.legalEntityData.webSite}<br>` : ''}
    ` : `<strong>Email:</strong> ${contrato.user.strUserName}<br>`;

    const configurations = contrato.package.configurations?.map(config => 
      `• ${config.totalAccount} cuentas ${config.rol.strName} a $${config.price} c/u`
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
        ${contactInfo}</p>
      </div>
      
      <h4>1. OBJETO DEL CONTRATO</h4>
      <p>Prestación de servicios SaaS "${contrato.package.name}"<br>
      <strong>Descripción:</strong> ${contrato.package.description}<br>
      <strong>Configuración:</strong><br>${configurations}</p>
      
      <h4>2. VALOR Y FORMA DE PAGO</h4>
      <p><strong>Valor total:</strong> $${contrato.value}<br>
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
    * Formatea valores monetarios al formato colombiano.
    */
  private formatCurrency(value: string | number): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toLocaleString('es-CO').replace(/,/g, '.') + ',oo';
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
    const textoValor = `el valor del presente contrato es de $${valorFormateado} (año), el cual será cancelado de la siguiente manera: (especificar forma de pago y periodicidad).`;
    
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
        pdf.text(`• ${config.totalAccount} cuentas ${config.rol.strName} - $${config.price} c/u`, 25, yPos);
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

  /**
    * Genera el contenido del PDF (extraído para reutilización).
    */
  private generatePDFContent(pdf: jsPDF, contrato: Contract, logoImg: HTMLImageElement): void {
    // Logo
    const logoWidth = 70;
    const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
    const logoX = (pdf.internal.pageSize.getWidth() - logoWidth) / 2;
    
    pdf.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
    
    // Título
    pdf.setFontSize(16);
    pdf.text('CONTRATO DE PRESTACIÓN DE SERVICIOS SAAS', 20, logoHeight + 25);
    
    pdf.setFontSize(14);
    pdf.text(`CONTRATO No. ${contrato.code || contrato.id}`, 20, logoHeight + 40);
    
    let yPosition = logoHeight + 60;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    const checkNewPage = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };
    
    // Proveedor
    checkNewPage(80);
    pdf.setFontSize(12);
    pdf.text('PROVEEDOR:', 20, yPosition);
    pdf.text('Cyclonet S. A. S.', 20, yPosition + 10);
    pdf.text('NIT: 901515884-4', 20, yPosition + 20);
    pdf.text('Dirección: Bonanza, Mz 23 Lt 30 (Turbaco - Bolívar)', 20, yPosition + 30);
    pdf.text('Teléfono: 314 414 4986 - 321 898 5475', 20, yPosition + 40);
    pdf.text('Email: ti.cyclonet@hotmail.com', 20, yPosition + 50);
    pdf.text('Sitio web: https://www.cyclonet.com.co/', 20, yPosition + 60);
    
    yPosition += 80;
    
    // Cliente
    const clientName = contrato.user.basicData?.legalEntityData?.businessName || 
                      `${contrato.user.basicData?.naturalPersonData?.firstName || ''} ${contrato.user.basicData?.naturalPersonData?.firstSurname || ''}`.trim() ||
                      contrato.user.strUserName;
    
    checkNewPage(60);
    pdf.line(20, yPosition - 5, 190, yPosition - 5);
    
    pdf.text('CLIENTE:', 20, yPosition);
    pdf.text(clientName, 20, yPosition + 10);
    pdf.text(`Email: ${contrato.user.strUserName}`, 20, yPosition + 20);
    
    if (contrato.user.basicData?.legalEntityData) {
      pdf.text(`Representante: ${contrato.user.basicData.legalEntityData.contactName}`, 20, yPosition + 30);
      pdf.text(`Teléfono: ${contrato.user.basicData.legalEntityData.contactPhone}`, 20, yPosition + 40);
      yPosition += 20;
    }
    
    yPosition += 40;
    pdf.line(20, yPosition, 190, yPosition);
    
    // Contenido del contrato
    yPosition += 20;
    checkNewPage(40);
    pdf.text('1. OBJETO DEL CONTRATO', 20, yPosition);
    pdf.text(`Servicio: ${contrato.package.name}`, 20, yPosition + 10);
    
    const description = contrato.package.description || 'Sin descripción';
    const descLines = pdf.splitTextToSize(`Descripción: ${description}`, 170);
    checkNewPage(descLines.length * 10 + 20);
    pdf.text(descLines, 20, yPosition + 20);
    yPosition += descLines.length * 10 + 30;
    
    checkNewPage(40);
    pdf.text('2. VALOR Y FORMA DE PAGO', 20, yPosition);
    pdf.text(`Valor total: $${contrato.value}`, 20, yPosition + 10);
    pdf.text(`Modalidad: ${contrato.mode}`, 20, yPosition + 20);
    if (contrato.payday) {
      pdf.text(`Día de pago: ${contrato.payday}`, 20, yPosition + 30);
      yPosition += 10;
    }
    
    yPosition += 40;
    checkNewPage(40);
    pdf.text('3. VIGENCIA', 20, yPosition);
    pdf.text(`Fecha de inicio: ${contrato.startDate}`, 20, yPosition + 10);
    pdf.text(`Fecha de finalización: ${contrato.endDate}`, 20, yPosition + 20);
    pdf.text(`Estado: ${contrato.status}`, 20, yPosition + 30);
    
    yPosition += 50;
    checkNewPage(60);
    pdf.text('4. OBLIGACIONES DEL PROVEEDOR', 20, yPosition);
    pdf.text('• Garantizar disponibilidad del servicio 24/7', 20, yPosition + 10);
    pdf.text('• Proporcionar soporte técnico', 20, yPosition + 20);
    pdf.text('• Mantener seguridad y confidencialidad de datos', 20, yPosition + 30);
    
    yPosition += 50;
    checkNewPage(60);
    pdf.text('5. OBLIGACIONES DEL CLIENTE', 20, yPosition);
    pdf.text('• Realizar pagos en fechas acordadas', 20, yPosition + 10);
    pdf.text('• Usar el servicio conforme a términos establecidos', 20, yPosition + 20);
    pdf.text('• No compartir credenciales con terceros', 20, yPosition + 30);
    
    yPosition += 50;
    checkNewPage(60);
    pdf.text('FIRMAS:', 20, yPosition);
    pdf.text('_________________________', 20, yPosition + 30);
    pdf.text('CYCLONET S.A.S.', 20, yPosition + 40);
    pdf.text('Representante Legal', 20, yPosition + 50);
    
    pdf.text('_________________________', 120, yPosition + 30);
    pdf.text('CLIENTE', 120, yPosition + 40);
    pdf.text(clientName, 120, yPosition + 50);
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
}