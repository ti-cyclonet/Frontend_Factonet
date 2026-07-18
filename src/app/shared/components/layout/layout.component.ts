import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { RouterModule, Router } from '@angular/router'; 
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { ParametrosGlobalesService } from '../../services/parametros-globales/parametros-globales.service';
import { FactonetService } from '../../services/factonet/factonet.service';
import { InvoiceRefreshService } from '../../services/invoice-refresh.service';
import { LoadingService } from '../../services/loading.service';
import { NAME_APP_SHORT } from '../../../config/config';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    FooterComponent,
    RouterModule 
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export default class LayoutComponent implements OnInit {
  optionsMenu: OptionMenu[] = [];
  isLargeScreen = false;
  application: Application | undefined;
  isLoading = false;

  constructor(
    private applicationsService: ApplicationsService,
    private parametrosService: ParametrosGlobalesService,
    private factonetService: FactonetService,
    private invoiceRefreshService: InvoiceRefreshService,
    private loadingService: LoadingService,
    private router: Router
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
  }

  ngOnInit(): void {
    this.fetchApplication(NAME_APP_SHORT);
    this.checkActivePeriod();

    // Update badge when invoices are refreshed
    this.invoiceRefreshService.refresh$.subscribe(() => {
      this.updateInvoiceBadge();
    });
  }

  private updateInvoiceBadge(): void {
    if (!this.isUserLoggedIn()) return;

    const userRol = sessionStorage.getItem('user_rol');

    this.factonetService.getInvoices().subscribe({
      next: (invoices) => {
        let hasNovelties = false;

        if (userRol === 'adminFactonet') {
          // Admin: badge when there are invoices to confirm or payments to verify
          const adminStatuses = ['Unconfirmed', 'Payment Reported'];
          hasNovelties = (invoices || []).some(inv => 
            adminStatuses.includes(inv.estado || inv.status)
          );
        } else {
          // Client (adminInvoices): badge when there are invoices pending payment or rejected
          const clientStatuses = ['Issued', 'In arrears', 'Notification1', 'Notification2', 'Suspended'];
          hasNovelties = (invoices || []).some(inv => 
            clientStatuses.includes(inv.estado || inv.status) || inv.rejectionReason
          );
        }

        // Set badge on Invoices tab
        const invoiceMenu = this.optionsMenu.find(m => 
          m.url === '/facturas' || m.url === '/invoices' || 
          (m.description || '').toLowerCase() === 'invoices'
        );
        if (invoiceMenu) {
          invoiceMenu.badge = hasNovelties ? -1 : undefined;
        }

        // Force change detection by reassigning array
        this.optionsMenu = [...this.optionsMenu];

        // For adminFactonet: check contracts needing action
        if (userRol === 'adminFactonet') {
          this.updateContractsBadge();
        }
      }
    });
  }

  private updateContractsBadge(): void {
    this.factonetService.getContracts().subscribe({
      next: (contracts) => {
        const actionableStatuses = ['PENDING', 'PENDING_SIGNATURE', 'PENDING_ADMIN_SIGNATURE', 'DRAFT'];
        const hasNovelties = (contracts || []).some(c => 
          actionableStatuses.includes(c.status)
        );

        const contractMenu = this.optionsMenu.find(m => 
          m.url === '/contracts' || (m.description || '').toLowerCase() === 'contracts'
        );
        if (contractMenu) {
          contractMenu.badge = hasNovelties ? -1 : undefined;
        }

        // Force change detection
        this.optionsMenu = [...this.optionsMenu];
      }
    });
  }

  fetchApplication(name: string): void {
    const userRol = sessionStorage.getItem('user_rol');
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    const userId = sessionStorage.getItem('user_id');
    const tenantId = localStorage.getItem('tenantId');
  
    if (!token || !userRol) {
      this.optionsMenu = [];
      return;
    }
  
    this.applicationsService.getApplicationByNameAndRol(name, userRol).subscribe({
      next: (app) => {
        if (!app) {
          this.optionsMenu = [];
          return;
        }
  
        this.application = app;

        this.optionsMenu = this.application?.strRoles?.flatMap(rol =>
          rol?.menuOptions?.map(menu => ({
            id: menu?.id ?? '',
            name: menu?.strName ?? 'Unnamed Menu',
            description: menu?.strDescription ?? '',
            url: menu?.strUrl ?? '#',
            icon: menu?.strIcon ?? 'default-icon',
            type: menu?.strType ?? 'main_menu',
            idMPather: null,
            order: menu?.ingOrder !== undefined && menu?.ingOrder !== null ? menu.ingOrder.toString() : '99',
            idApplication: this.application?.id ?? '',
          })) || []
        ) || [];

        // Eliminar duplicados por ID
        const uniqueMenus = new Map();
        this.optionsMenu.forEach(menu => {
          uniqueMenus.set(menu.id, menu);
        });
        this.optionsMenu = Array.from(uniqueMenus.values());

        // Si es usuario con rol adminInvoices, filtrar solo Invoices y Contracts
        if (userRol === 'adminInvoices') {
          this.optionsMenu = this.optionsMenu.filter(menu => 
            menu.url === '/facturas' || menu.name.toLowerCase().includes('invoice') ||
            menu.url === '/contracts' || menu.name.toLowerCase().includes('contract')
          );
        }

        // Ordenar por ingOrder numérico
        this.optionsMenu.sort((a, b) => parseInt(a.order) - parseInt(b.order));

        if (this.optionsMenu.length === 0) {
          // Si no hay opciones del backend, no cargar menú estático
          this.optionsMenu = [];
        }

        // Update badges after menu is loaded
        this.updateInvoiceBadge();
      },
      error: (err) => {
        // En caso de error, no cargar menú estático
        this.optionsMenu = [];
      }
    });
  }



  checkActivePeriod(): void {
    if (!this.isUserLoggedIn()) return;
    
    // Si es usuario con rol adminInvoices, no verificar período activo
    const userRol = sessionStorage.getItem('user_rol');
    if (userRol === 'adminInvoices') {
      return;
    }
    
    this.parametrosService.getPeriodos().subscribe({
      next: (periodos) => {
        const periodoActivo = periodos.find(p => p.status === 'ACTIVE');
        if (!periodoActivo) {
          Swal.fire({
            title: 'No Active Period',
            text: 'No active period exists. You must create and activate a period to continue.',
            icon: 'warning',
            confirmButtonText: 'Go to Periods',
            allowOutsideClick: false
          }).then(() => {
            this.router.navigate(['/parametros-globales']);
          });
        }
      },
      error: () => {
        // Si hay error, asumir que no hay períodos
        Swal.fire({
          title: 'No Periods Configured',
          text: 'You must create and activate a period to continue.',
          icon: 'warning',
          confirmButtonText: 'Go to Periods',
          allowOutsideClick: false
        }).then(() => {
          this.router.navigate(['/parametros-globales']);
        });
      }
    });
  }


  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  isUserLoggedIn(): boolean {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    return !!token;
  }
}