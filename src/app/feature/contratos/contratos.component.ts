import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { EsLabelPipe, esLabel } from '../../shared/pipes/es-label.pipe';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { ContractPdfService } from '../../shared/services/contract-pdf.service';
import { InvoiceRefreshService } from '../../shared/services/invoice-refresh.service';
import { Contract } from '../../shared/model/contract.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { getAnexosText, getContractBodyText, getContractVars, numberToWords, writeContractToPDF, contractPdfBase64 } from '../../shared/utils/contract-document';

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
  imports: [CommonModule, ReplacePipe, EsLabelPipe],
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
  showFilters = false; // Controla la visibilidad de los filtros
  userRol: string | null = null;
  isAuthorizedSigner = false;
  
  // Filters
  filters = {
    status: '',
    code: '',
    user: '',
    package: '',
    billable: ''
  };
  filteredContratos = signal<Contract[]>([]);
  /** Paquetes presentes en los contratos cargados, para el filtro. */
  packageOptions = computed(() =>
    [...new Set(this.contratos().map(c => c.package?.name).filter((n): n is string => !!n))]
      .sort((a, b) => a.localeCompare(b))
  );
  
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
    private contractPdfService: ContractPdfService,
    private invoiceRefreshService: InvoiceRefreshService
  ) { 
    // Las signals reemplazan la necesidad de inicializar arrays vacíos aquí
  }

  ngOnInit(): void {
    this.userRol = sessionStorage.getItem('user_rol');
    this.isAuthorizedSigner = sessionStorage.getItem('user_isAuthorizedSigner') === 'true';
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
        this.applyFilters();
        // Limpiar y actualizar contratos con PDF
        this.contractsWithPDF.clear();
        contratosOrdenados.forEach(contrato => {
          if (contrato.pdfUrl) {
            this.contractsWithPDF.add(contrato.id);
          }
        });
        // Update modalContrato if it's open
        if (this.modalContrato) {
          const updated = contratosOrdenados.find(c => c.id === this.modalContrato!.id);
          if (updated) {
            this.modalContrato = updated;
          }
        }
        if (contratosOrdenados.length > 0) {
          this.showToast('Contratos cargados', 'success', 'A', 0);
        } else {
          this.showToast('No hay contratos', 'primary', 'A', 0);
        }
      },
      error: (error) => {
        this.contratos.set([]);
        this.showToast('No se pudo conectar con el servidor de contratos', 'danger', 'A', 0);
      }
    });
  }

  /**
   * Abre el modal para añadir un nuevo contrato.
   */
  openContratoModal() { 
    this.isModalOpen.set(true);
    this.showToast('Abriendo la creación de contratos…', 'primary', 'A', 0);
  }

  /**
   * Closes the modal and refreshes all data/badges.
   */
  closeModal(): void {
    this.loadContratos();
    this.invoiceRefreshService.triggerRefresh();
  }

  /**
   * Muestra los detalles del contrato en el modal.
   */
  viewContrato(contrato: Contract) {
    this.modalContrato = contrato; // Usar propiedad normal en lugar de signal
    this.selectedContrato.set(contrato);
    this.showUserDetails.set(false); // Resetear al abrir modal
    this.showPackageDetails.set(false); // Resetear al abrir modal
    this.showToast(`Viendo el contrato ${contrato.code || contrato.id}`, 'primary', 'A', 0);
    
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
      // Auto-issue the contract after PDF generation
      this.factonetService.issueContract(contrato.id).subscribe({
        next: () => {
          this.generatingPDF.set(false);
          this.loadContratos();
          setTimeout(() => {
            const contratoActualizado = this.contratos().find(c => c.id === contrato.id);
            if (contratoActualizado) {
              if (this.modalContrato && this.modalContrato.id === contrato.id) {
                this.modalContrato = { ...this.modalContrato, pdfUrl: contratoActualizado.pdfUrl, issuedAt: contratoActualizado.issuedAt };
              }
              this.showPDFOptions(contratoActualizado);
            }
          }, 1000);
        },
        error: () => {
          // If issue fails, still show PDF options
          this.generatingPDF.set(false);
          this.loadContratos();
          setTimeout(() => {
            const contratoActualizado = this.contratos().find(c => c.id === contrato.id);
            if (contratoActualizado) {
              if (this.modalContrato && this.modalContrato.id === contrato.id) {
                this.modalContrato = { ...this.modalContrato, pdfUrl: contratoActualizado.pdfUrl };
              }
              this.showPDFOptions(contratoActualizado);
            }
          }, 1000);
        }
      });
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
      title: 'PDF listo',
      text: `El contrato ${contrato.code || contrato.id} está listo`,
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
  private getContractVars(contrato: Contract) {
    return getContractVars(contrato);
  }

  private getContractBodyText(contrato: Contract): string {
    return getContractBodyText(contrato);
  }

  private getAnexosText(): string {
    return getAnexosText();
  }

  private generateContractHTML(contrato: Contract): string {
    const v = this.getContractVars(contrato);
    const body = this.getContractBodyText(contrato);
    return '<div class="contract-pdf-content" style="font-family: Arial, sans-serif; font-size: 9px; line-height: 1.4; text-align: justify; max-height: 70vh; overflow-y: auto; padding: 20px;">'
    + '<div style="text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 8px;">CONTRATO DE PRESTACI\u00d3N DE SERVICIOS SAAS</div>'
    + '<div style="text-align: center; font-weight: bold; font-size: 10px; margin-bottom: 15px;">CONTRATO No. ' + (contrato.code || contrato.id) + '</div>'
    + '<p style="margin: 0 0 10px 0;">' + body + '</p>'
    + '<p style="margin: 15px 0 10px 0;">En constancia se firma en medio electr\u00f3nico en la fecha indicada en el encabezado o acta de inicio.</p>'
    + '<table style="width: 100%; font-size: 9px; margin-top: 15px;"><tr>'
    + '<td style="width: 50%; vertical-align: top; padding-right: 20px;"><strong>CONTRATISTA:</strong><br>CYCLONET S. A. S<br>NIT 901.515.884-3<br>Representante legal: ALFREDO MAMBY BOSSA<br>CC: 7921161<br><br><br>Firma: ___________________________<br>Ciudad y fecha: ' + v.fechaSistema + '</td>'
    + '<td style="width: 50%; vertical-align: top;"><strong>CONTRATANTE:</strong><br>' + v.clientName + '<br>' + v.docType + ' ' + v.docNumber + '<br>Representante: ' + v.contactName + '<br><br><br>Firma: ___________________________<br>Ciudad y fecha: ' + v.fechaSistema + '</td>'
    + '</tr></table>'
    + '<hr style="margin: 20px 0;">'
    + '<p style="font-size: 8px;">' + this.getAnexosText() + '</p>'
    + '</div>';
  }


  /**
   * Convierte un número a su representación en letras (español colombiano).
   */
  private numberToWords(num: number): string {
    return numberToWords(num);
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
    this.writeContractToPDF(pdf, contrato);
    const pdfBuffer = pdf.output('arraybuffer');
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    return new Promise((resolve, reject) => {
      this.contractPdfService.uploadContractPDF(contrato.id, base64PDF).subscribe({
        next: (result) => { console.log('PDF subido exitosamente:', result.pdfUrl); resolve(); },
        error: (error) => { console.error('Error subiendo PDF:', error); reject(error); }
      });
    });
  }

  /**
   * Garantiza que el contrato tenga PDF generado y esté emitido (issuedAt),
   * requisito del backend para poder firmarlo. Si ya tiene PDF, no hace nada.
   * Genera el PDF (jsPDF), lo sube y emite el contrato. Idempotente.
   */
  private async ensurePdfIssued(contrato: Contract): Promise<void> {
    if (contrato.pdfUrl) return;
    await this.generateAndUploadPDF(contrato);
    await new Promise<void>((resolve, reject) => {
      this.factonetService.issueContract(contrato.id).subscribe({
        next: () => resolve(),
        // Si el emitir falla pero el PDF ya subió, dejamos que el backend
        // valide; propagamos el error para no firmar a ciegas.
        error: (err) => reject(err),
      });
    });
  }

  private downloadContractPDF(contrato: Contract) {
    const pdf = new jsPDF();
    this.writeContractToPDF(pdf, contrato);
    pdf.save('Contrato_' + (contrato.code || contrato.id) + '.pdf');
  }

  private writeContractToPDF(pdf: jsPDF, contrato: Contract): void {
    writeContractToPDF(pdf, contrato);
  }

  /**
   * Applies filters to the contracts list
   */
  applyFilters(): void {
    let result = [...this.contratos()];

    if (this.filters.status) {
      result = result.filter(c => c.status === this.filters.status);
    }
    if (this.filters.code) {
      result = result.filter(c => 
        (c.code || c.id || '').toLowerCase().includes(this.filters.code.toLowerCase())
      );
    }
    if (this.filters.user) {
      result = result.filter(c => 
        (c.user?.strUserName || '').toLowerCase().includes(this.filters.user.toLowerCase())
      );
    }
    if (this.filters.package) {
      result = result.filter(c => c.package?.name === this.filters.package);
    }
    if (this.filters.billable) {
      const isBillable = this.filters.billable === 'yes';
      result = result.filter(c => (c.package?.isBillable !== false) === isBillable);
    }

    this.filteredContratos.set(result);
  }

  clearFilters(): void {
    this.filters = { status: '', code: '', user: '', package: '', billable: '' };
    this.applyFilters();
  }

  /**
   * Establece el contrato seleccionado o lo deselecciona.
   */
  setSelectedContrato(contrato: Contract) { 
    if (this.selectedContrato() === contrato) {
        this.selectedContrato.set(null);
    } else {
      this.selectedContrato.set(contrato);
      this.showToast(`Registro seleccionado: ${contrato.id}`, 'success', 'A', 0);
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
        this.showToast('No hay ningún registro seleccionado para eliminar.', 'warning', 'A', 0);
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
        
        this.showToast(`Registro ${idToDelete} eliminado (simulación local).`, 'danger', 'A', 0);
        this.selectedContrato.set(null);
        this.isDeleteConfirmationModalOpen.set(false); // Cierra el modal
    } else {
      this.showToast('No hay ningún registro seleccionado para eliminar.', 'warning', 'A', 0);
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
   * Opens a SweetAlert select for changing contract status from the modal
   */
  openStatusChangeFromModal(contrato: any) {
    const inputOptions: Record<string, string> = {};
    this.contractStatuses.forEach(s => { inputOptions[s] = esLabel(s); });

    Swal.fire({
      title: 'Cambiar estado',
      input: 'select',
      inputOptions,
      inputValue: contrato.status,
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.changeContractStatus(contrato.id, result.value);
      }
    });
  }

  /**
   * Cambia el estado del contrato
   */
  changeContractStatus(contractId: string, newStatus: string) {
    // Si es activación, validar el flujo completo
    if (newStatus === 'ACTIVE') {
      const contract = this.contratos().find(c => c.id === contractId);
      if (contract) {
        // Step 1: Validar PDF generado
        if (!contract.pdfUrl || contract.pdfUrl.trim() === '') {
          Swal.fire({
            title: 'Falta el PDF del contrato',
            text: 'Primero genera el PDF del contrato con el botón PDF en el detalle del contrato.',
            icon: 'warning',
            confirmButtonText: 'Entendido'
          });
          this.closeStatusDropdown();
          return;
        }
        
        // Step 2: Validar que fue emitido (enviado al cliente)
        if (!contract.issuedAt) {
          Swal.fire({
            title: 'Contrato sin emitir',
            text: 'El contrato debe emitirse (enviarse al cliente para revisión) antes de activarlo. Usa la acción "Emitir".',
            icon: 'warning',
            confirmButtonText: 'Entendido'
          });
          this.closeStatusDropdown();
          return;
        }

        // Step 3: Validar firma
        if (!contract.signedAt) {
          Swal.fire({
            title: 'Contrato sin firmar',
            text: 'El cliente debe firmar el contrato antes de activarlo. Usa la acción "Firmar" cuando el cliente confirme.',
            icon: 'warning',
            confirmButtonText: 'Entendido'
          });
          this.closeStatusDropdown();
          return;
        }
        
        // All validations passed — confirm activation
        Swal.fire({
          title: 'Activar contrato',
          text: 'El contrato ya está generado, emitido y firmado. ¿Quieres activarlo ahora?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, activar',
          cancelButtonText: 'Cancelar',
          reverseButtons: true
        }).then((result) => {
          if (result.isConfirmed) {
            this.proceedWithActivation(contractId, newStatus);
          } else {
            this.closeStatusDropdown();
          }
        });
        
        return;
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
        title: 'Activando contrato…',
        text: 'Validando requisitos y activando el contrato',
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
            title: 'Activado',
            text: 'El contrato quedó activo.',
            icon: 'success',
            confirmButtonText: 'Aceptar'
          });
        } else {
          this.showToast(`Estado actualizado: ${esLabel(newStatus)}`, 'success', 'A', 0);
        }
        this.closeStatusDropdown();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Error al actualizar el estado';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
        this.closeStatusDropdown();
        console.error('Error updating contract status:', error);
      }
    });
  }

  signContract(contrato: any) {
    if (!contrato.pdfUrl) {
      Swal.fire({
        title: 'No se puede firmar',
        text: 'Genera el PDF del contrato antes de firmarlo.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    Swal.fire({
      title: 'Firmar contrato',
      text: `¿Seguro que quieres marcar como firmado el contrato ${contrato.code}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, firmar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.factonetService.signContract(contrato.id).subscribe({
          next: (response) => {
            // Update local state
            this.contratos.update(contracts =>
              contracts.map(c => c.id === contrato.id ? { ...c, signedAt: new Date().toISOString() } : c)
            );
            if (this.modalContrato) {
              this.modalContrato = { ...this.modalContrato, signedAt: new Date().toISOString() };
            }
            Swal.fire('Firmado', 'El contrato quedó firmado.', 'success');
          },
          error: (error) => {
            Swal.fire('Error', error.error?.message || 'No se pudo firmar el contrato.', 'error');
          }
        });
      }
    });
  }

  signContractAsAdmin(contrato: any) {
    const adminName = sessionStorage.getItem('user_name') || sessionStorage.getItem('user_email') || 'Admin';

    Swal.fire({
      title: 'Firmar como Administrador',
      html: `
        <p style="font-size: 14px;">¿Confirmas la firma del contrato <strong>${contrato.code}</strong> como administrador?</p>
        <p style="font-size: 12px; color: #6c757d;">Esta acción registra tu firma digital con fecha, hora e IP.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Firmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Opción B': si el contrato aún no tiene PDF (ej. contratos de upgrade
        // Kiri PLUS), lo generamos y emitimos automáticamente antes de firmar.
        try {
          if (!contrato.pdfUrl) {
            Swal.fire({
              title: 'Preparando contrato...',
              html: '<p style="font-size:13px;">Generando el documento antes de firmar.</p>',
              allowOutsideClick: false,
              didOpen: () => Swal.showLoading(),
            });
            await this.ensurePdfIssued(contrato);
          }
        } catch (e: any) {
          Swal.fire('Error', 'No se pudo preparar el contrato para la firma. Intenta de nuevo.', 'error');
          return;
        }

        this.factonetService.signAsAdmin(contrato.id, adminName).subscribe({
          next: (response) => {
            this.contratos.update(contracts =>
              contracts.map(c => c.id === contrato.id ? { ...c, ...response } : c)
            );
            if (this.modalContrato) {
              this.modalContrato = { ...this.modalContrato, ...response };
            }
            const msg = response.status === 'ACTIVE' 
              ? '¡Contrafirma registrada!' 
              : '¡Firma registrada exitosamente!';
            Swal.fire({
              icon: 'success',
              title: msg,
              html: response.status === 'ACTIVE' 
                ? '<p style="font-size:13px;">Contrafirma registrada. El contrato está activo.</p>' 
                : '<p style="font-size:13px;">Se notificó al cliente: el contrato se activa en cuanto él firme.</p>',
              confirmButtonColor: '#0d6efd',
            });
            this.loadContratos();
          },
          error: (error) => {
            Swal.fire('Error', error.error?.message || 'No se pudo registrar la firma.', 'error');
          }
        });
      }
    });
  }

  signContractAsClient(contrato: any) {
    const clientName = sessionStorage.getItem('user_name') || sessionStorage.getItem('user_email') || 'Cliente';

    Swal.fire({
      title: 'Firmar Contrato',
      html: `
        <p style="font-size: 14px;">Al firmar, aceptas los términos del contrato <strong>${contrato.code}</strong>.</p>
        <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 12px; text-align: left;">
          <p style="margin:0;"><strong>Paquete:</strong> ${contrato.package?.name || 'N/A'}</p>
          <p style="margin:4px 0 0;"><strong>Valor:</strong> $${Number(contrato.value || 0).toLocaleString('es-CO')} COP</p>
          <p style="margin:4px 0 0;"><strong>Modo:</strong> ${contrato.mode}</p>
        </div>
        <label style="font-size: 13px; cursor: pointer;">
          <input type="checkbox" id="swal-accept-terms" style="margin-right: 6px;">
          Acepto los términos y condiciones del contrato
        </label>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Firmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      preConfirm: () => {
        const accepted = (document.getElementById('swal-accept-terms') as HTMLInputElement)?.checked;
        if (!accepted) {
          Swal.showValidationMessage('Debes aceptar los términos para firmar');
          return false;
        }
        return true;
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Autoservicio: si el contrato aún no tiene PDF, se genera aquí.
        try {
          await this.contractPdfService.ensurePdf(contrato);
        } catch {
          Swal.fire('Error', 'No se pudo preparar el contrato para la firma. Intenta de nuevo.', 'error');
          return;
        }
        this.factonetService.signAsClient(contrato.id, clientName).subscribe({
          next: (response) => {
            this.contratos.update(contracts =>
              contracts.map(c => c.id === contrato.id ? { ...c, ...response } : c)
            );
            if (this.modalContrato) {
              this.modalContrato = { ...this.modalContrato, ...response };
            }
            const msg = response.status === 'ACTIVE' 
              ? '¡Contrato firmado y activado!' 
              : '¡Firma registrada!';
            Swal.fire({
              icon: 'success',
              title: msg,
              html: response.status === 'ACTIVE' 
                ? '<p style="font-size:13px;">Tu plan quedó activo.</p>' 
                : '<p style="font-size:13px;">Tu firma fue registrada.</p>',
              confirmButtonColor: '#0d6efd',
            });
          },
          error: (error) => {
            Swal.fire('Error', error.error?.message || 'No se pudo registrar la firma.', 'error');
          }
        });
      }
    });
  }
}