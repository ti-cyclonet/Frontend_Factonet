import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// Interface para un tipado estricto
interface Contrato {
    id: string;
    user: string;
    package: string;
    value: number;
    payday: number;
    startDate: string;
    endDate: string;
    status: 'Active' | 'Expired' | 'Pending'; 
}

@Component({
  selector: 'app-contratos', 
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contratos.component.html', 
  styleUrls: ['./contratos.component.css'] 
})
export class ContratosComponent implements OnInit { 
  
  // Utilizamos signals para el estado reactivo
  contratos = signal<Contrato[]>([]);
  selectedContrato = signal<Contrato | null>(null); 
  
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

  constructor(private cdr: ChangeDetectorRef) { 
    // Las signals reemplazan la necesidad de inicializar arrays vacíos aquí
  }

  ngOnInit(): void {
    // Carga de datos simulados
    this.loadMockContratos();
  }

  /**
    * Carga datos simulados de contratos.
    */
  loadMockContratos(): void {
    this.contratos.set([
      { id: '1272747-a4a7-4b74-9142-6eeebf7765368', user: 'jimmykon-inout.com', package: 'Inout Basic Package for Jimmykon, Development', value: 900000.00, payday: 5, startDate: '2025-08-20', endDate: '2026-08-20', status: 'Pending' },
      { id: 'eba5ea0b-059c-42d1-99f1-68e29a0aee48', user: 'jimmykon-inout.com', package: 'Inout Basic Package for Jimmykon Development', value: 739200.00, payday: 5, startDate: '2025-08-20', endDate: '2026-08-20', status: 'Active' }
    ]);
  }

  /**
    * Abre el modal para añadir un nuevo contrato.
    */
  openContratoModal() { 
    this.isModalOpen.set(true);
    this.showToast('SYSTEM: Opening Contract Creation Interface...', 'primary', 'A', 0);
  }

  /**
    * Simula la acción de edición.
    */
  onEditContrato() {
    const contrato = this.selectedContrato();
    if (contrato) {
        this.showToast(`ACCESSING RECORD: ${contrato.id}. (Edit Simulation)`, 'primary', 'A', 0);
    }
  }


  /**
    * Establece el contrato seleccionado o lo deselecciona.
    */
  setSelectedContrato(contrato: Contrato) { 
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
  trackById(index: number, contrato: Contrato): string { 
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