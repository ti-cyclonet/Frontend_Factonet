import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import { Contract } from '../../shared/model/contract.model';

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
    private factonetService: FactonetService
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