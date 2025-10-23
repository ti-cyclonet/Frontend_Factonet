import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';
import { NotificationsComponent } from "../../shared/components/notifications/notifications.component";

// Interface for strong typing and better code quality
interface Contrato {
    id: string;
    client: string;
    startDate: string;
    endDate: string;
    value: number;
    status: 'Active' | 'Expired' | 'Pending'; 
}

@Component({
  selector: 'app-contratos', 
  standalone: true,
  // Added CurrencyPipe and UpperCasePipe to imports for standalone consistency
  imports: [CommonModule, NotificationsComponent, CurrencyPipe, UpperCasePipe],
  templateUrl: './contratos.component.html', 
  styleUrls: ['./contratos.component.css'] 
})
export class ContratosComponent implements OnInit { 
  
  @ViewChild('notification') notification!: NotificationsComponent;
  
  // Strongly typed contracts array
  contratos: Contrato[] = [];
  selectedContrato: Contrato | null = null; 
  isModalOpen = false;

  // Configuration for notifications
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B';
    container: 0 | 1;
    visible: boolean;
  }> = [];
  
  showOptions = true; // Controls the visibility of the options panel

  constructor(private cdr: ChangeDetectorRef) { 
    this.notifications = [];
  }

  ngOnInit(): void {
    // Load simulation data on component initialization
    this.loadMockContratos();
  }

  /**
   * Loads simulated contract data for frontend development.
   */
  loadMockContratos(): void {
    // Futuristic/Mock Data examples
    this.contratos = [
      { id: 'CX-1001', client: 'AetherSys Corp', startDate: '2024-07-20', endDate: '2025-07-20', value: 350000.00, status: 'Active' },
      { id: 'CX-1002', client: 'Nexus Global', startDate: '2023-01-10', endDate: '2024-01-10', value: 80500.00, status: 'Expired' },
      { id: 'CX-1003', client: 'Orion Tech', startDate: '2025-01-01', endDate: '2026-01-01', value: 12000.50, status: 'Pending' },
      { id: 'CX-1004', client: 'Vortex Dynamics', startDate: '2024-09-01', endDate: '2025-09-01', value: 98000.00, status: 'Active' },
      { id: 'CX-1005', client: 'Zenith Labs', startDate: '2023-11-15', endDate: '2024-11-15', value: 4500.00, status: 'Expired' },
    ];
  }

  /**
   * Opens the modal for adding a new contract.
   */
  openContratoModal() { 
    this.isModalOpen = true;
    this.showToast('SYSTEM: Opening Contract Creation Interface...', 'primary', 'A', 0);
  }

  /**
   * Sets the selected contract, deselecting if it is clicked again.
   */
  setSelectedContrato(contrato: Contrato) { 
    if (this.selectedContrato === contrato) {
        this.selectedContrato = null;
    } else {
        this.selectedContrato = contrato;
    }
    this.cdr.detectChanges(); 
  }

  /**
   * Confirms and simulates the deletion of the selected contract.
   */
  confirmDeleteContrato() { 
    if (this.selectedContrato) {
      const idToDelete = this.selectedContrato.id;
      
      // Simulation of deletion: filter the local contracts array
      this.contratos = this.contratos.filter(c => c.id !== idToDelete);
      
      this.showToast(`RECORD ${idToDelete} DELETED successfully (Local Simulation).`, 'danger', 'A', 0);
      this.selectedContrato = null;
    } else {
      this.showToast('ERROR: No record selected for deletion.', 'warning', 'A', 0);
    }
  }

  /**
   * Function trackBy for optimized *ngFor performance.
   */
  trackById(index: number, contrato: Contrato): string { 
    return contrato.id;
  }

  // --- NOTIFICATION UTILITY FUNCTIONS ---

  /**
   * Removes a notification by index.
   */
  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }

  /**
   * Displays a transient (Type A) or persistent (Type B) notification.
   */
  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
    const notification = {
      title: message,
      type,
      alertType,
      container,
      visible: true
    };
    this.notifications.push(notification);
    this.cdr.detectChanges();

    if (alertType === 'A') {
      setTimeout(() => {
        notification.visible = false;
        this.cdr.detectChanges();
      }, 5000);
    }
  }
}
