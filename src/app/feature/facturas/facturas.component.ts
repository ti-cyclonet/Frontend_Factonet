import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, UpperCasePipe } from '@angular/common';

// Asumo que tienes un componente de notificaciones en esta ruta relativa.
import { NotificationsComponent } from "../../shared/components/notifications/notifications.component";

// Interface para tipado fuerte de una Factura
interface Factura {
    id: string;
    numero: string; // Número de Factura (ej: INV-2024-001)
    cliente: string;
    fechaEmision: string; // Fecha de emisión (YYYY-MM-DD)
    fechaVencimiento: string; // Fecha de vencimiento (YYYY-MM-DD)
    total: number;
    estado: 'Pagada' | 'Pendiente' | 'Vencida'; 
}

// Interface para tipado de Notificaciones
interface NotificationItem {
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B'; // 'A' para Toast flotante, 'B' para Alert ancho completo
    container: 0 | 1; // 0 para flotante (derecha), 1 para ancho completo (arriba)
    visible: boolean;
}

@Component({
    selector: 'app-facturas', 
    standalone: true,
    // Aseguramos que los imports necesarios (incluyendo CurrencyPipe) estén disponibles
    // y que NotificationsComponent esté disponible para la plantilla.
    imports: [CommonModule, NotificationsComponent, CurrencyPipe, UpperCasePipe],
    templateUrl: './facturas.component.html', 
    styleUrls: ['./facturas.component.css'] 
})
export class FacturasComponent implements OnInit { 
    
    // Array de facturas (datos de la tabla)
    facturas: Factura[] = [];
    // Estado para manejar la fila seleccionada
    selectedFactura: Factura | null = null; 
    // Estado para controlar la visibilidad de un modal de creación (si existiera)
    isModalOpen = false;

    // Array para manejar las notificaciones
    notifications: NotificationItem[] = [];
    
    constructor(private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        // Cargar datos simulados al inicializar
        this.loadMockFacturas();
        // Mensaje inicial ajustado para el nuevo tema: banner de primary (azul)
        this.showToast('Módulo de Facturación Inicializado: Datos de prueba cargados correctamente.', 'primary', 'B', 1);
    }

    /**
     * Carga datos simulados de facturas.
     */
    loadMockFacturas(): void {
        this.facturas = [
            { id: 'F-1001', numero: 'INV-2024-001', cliente: 'Solaris Energy Group', fechaEmision: '2024-10-15', fechaVencimiento: '2024-11-15', total: 15300.75, estado: 'Pendiente' },
            { id: 'F-1002', numero: 'INV-2024-002', cliente: 'Quantum Robotics', fechaEmision: '2024-09-01', fechaVencimiento: '2024-10-01', total: 450.00, estado: 'Vencida' },
            { id: 'F-1003', numero: 'INV-2024-003', cliente: 'Alpha Logistics Inc.', fechaEmision: '2024-08-20', fechaVencimiento: '2024-09-20', total: 820.75, estado: 'Pagada' },
            { id: 'F-1004', numero: 'INV-2024-004', cliente: 'Digital Forge Studio', fechaEmision: '2024-11-05', fechaVencimiento: '2024-12-05', total: 980.00, estado: 'Pendiente' },
            { id: 'F-1005', numero: 'INV-2024-005', cliente: 'Eco-Grow Farms', fechaEmision: '2024-07-25', fechaVencimiento: '2024-08-25', total: 4500.00, estado: 'Pagada' },
            { id: 'F-1006', numero: 'INV-2024-006', cliente: 'Innovación Global', fechaEmision: '2024-11-25', fechaVencimiento: '2024-12-25', total: 125.50, estado: 'Pendiente' },
        ];
    }

    /**
     * Devuelve las clases CSS de Tailwind apropiadas para el estado de la factura (Badge).
     */
    getStatusClass(estado: Factura['estado']): string {
        // Estas clases coinciden con las definidas en facturas.component.css
        switch (estado) {
            case 'Pagada':
                return 'text-green-700 bg-green-100';
            case 'Pendiente':
                return 'text-yellow-700 bg-yellow-100';
            case 'Vencida':
                return 'text-red-700 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    }

    /**
     * Simula la apertura de un modal o formulario para crear una nueva factura.
     */
    openFacturaModal() { 
        this.isModalOpen = true;
        this.showToast('Abriendo interfaz de Creación de Factura...', 'primary', 'A', 0);
    }

    /**
     * Selecciona la factura, si ya está seleccionada, la deselecciona.
     */
    setSelectedFactura(factura: Factura) { 
        if (this.selectedFactura === factura) {
            this.selectedFactura = null;
            this.showToast('Selección de factura anulada.', 'primary', 'A', 0);
        } else {
            this.selectedFactura = factura;
            this.showToast(`Factura ${factura.numero} seleccionada.`, 'success', 'A', 0);
        }
        // Forzar la detección de cambios para actualizar la vista
        this.cdr.detectChanges(); 
    }

    /**
     * Simula la eliminación de la factura seleccionada.
     */
    confirmDeleteFactura() { 
        if (this.selectedFactura) {
            const idToDelete = this.selectedFactura.id;
            const numeroToDelete = this.selectedFactura.numero;
            
            // Simulación de eliminación: filtrar el array local
            this.facturas = this.facturas.filter(f => f.id !== idToDelete);
            
            this.showToast(`Factura ${numeroToDelete} ELIMINADA exitosamente.`, 'danger', 'A', 0);
            this.selectedFactura = null;
        } else {
            this.showToast('ERROR: No se ha seleccionado ninguna factura para eliminar.', 'warning', 'A', 0);
        }
    }

    /**
     * Función trackBy para rendimiento optimizado de ngFor.
     */
    trackById(index: number, factura: Factura): string { 
        return factura.id;
    }

    // ----------------------------------------------------
    // --- FUNCIONES DE UTILIDAD DE NOTIFICACIONES ---
    // ----------------------------------------------------

    /**
     * Elimina una notificación por índice.
     */
    removeNotification(index: number) {
        this.notifications.splice(index, 1);
        this.cdr.detectChanges();
    }

    /**
     * Muestra una notificación con un mensaje, tipo y comportamiento específico.
     * @param message El texto a mostrar.
     * @param type El tipo de alerta (success, warning, danger, primary).
     * @param alertType Tipo de formato ('A': Toast flotante, 'B': Alert ancho completo).
     * @param container El contenedor (0: flotante, 1: ancho completo).
     */
    showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1 ) {
        const notification: NotificationItem = {
            title: message,
            type,
            alertType,
            container,
            visible: true
        };
        this.notifications.push(notification);
        this.cdr.detectChanges();

        if (alertType === 'A') { // Ocultar automáticamente si es un Toast flotante
            setTimeout(() => {
                const index = this.notifications.indexOf(notification);
                if (index > -1 && this.notifications[index]) {
                    // Establecer visible a false para que se oculte
                    this.notifications[index].visible = false;
                    this.cdr.detectChanges();
                    // Limpiar el array completamente después de un tiempo si se desea
                    // setTimeout(() => this.removeNotification(index), 500);
                }
            }, 5000); // 5 segundos de visibilidad
        }
    }
}
