import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { Router, RouterModule } from '@angular/router'; 
import { OptionMenu } from '../../model/option_menu'; 
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { UserDataService, UserData } from '../../services/user/user-data.service';
import { DashboardService, DashboardMetrics } from '../../services/dashboard/dashboard.service';
import { FactonetService } from '../../services/factonet/factonet.service';
import { NavbarComponent } from '../navbar/navbar.component'; 

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,     
    RouterModule,     
    FormsModule,      
    ReactiveFormsModule,
    NavbarComponent
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  dropdownOpen: boolean = false;
  private resizeListener: any;
  window = window;

  @Input() optionsMenu: OptionMenu[] = []; 
  
  // PROPIEDADES 
  nombreApp: string = 'FactoNET'; 
  userImage: string | undefined = undefined; 
  userRolDescription: string = ''; 
  userEmail: string = ''; 
  form: any; 
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    container: 0 | 1;
    visible: boolean;
  }> = []; 
    
  // Propiedades originales
  userName: string = ''; 
  userRole: string = ''; 

  // Controla la visibilidad de la caja de herramientas deslizable
  showToolbox: boolean = false;
  
  // Facturas pendientes para móvil
  pendingInvoices: number = 0; 

  constructor(
    private router: Router,
    private authService: AuthService,
    private userDataService: UserDataService,
    private dashboardService: DashboardService,
    private factonetService: FactonetService
  ) { }

  ngOnInit(): void {
    this.checkScreenSize();
    this.loadUserData();
    this.loadNotifications();
    this.loadPendingInvoices();

    this.resizeListener = this.checkScreenSize.bind(this);
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth < 768; // o el breakpoint que prefieras
    if (!this.isMobile) {
      this.dropdownOpen = false; // cerrar dropdown si no es móvil
    }  
  }

  get mobileNotifications() {
    return this.notifications.filter(n => n.container === 0);
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }
  

  
  loadPendingInvoices(): void {
    this.factonetService.getInvoices().subscribe({
      next: (facturas) => {
        this.pendingInvoices = facturas.filter(f => f.estado === 'Pendiente').length;
      },
      error: (error) => {

        this.pendingInvoices = 0;
      }
    });
    
    // Actualizar cada 30 segundos
    setInterval(() => {
      this.factonetService.getInvoices().subscribe({
        next: (facturas) => {
          this.pendingInvoices = facturas.filter(f => f.estado === 'Pendiente').length;
        },
        error: () => {
          this.pendingInvoices = 0;
        }
      });
    }, 30000);
  }
  // <-- PÉGALO AQUÍ
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (
      !target.closest('.notification-bell') &&
      !target.closest('.notifications-menu')
    ) {
      this.dropdownOpen = false;
    }
  }

  
  logout() { 
    this.authService.logout();
  }

  onSubmit() {

  }

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }

  loadUserData(): void {
    // Cargar datos inmediatamente desde sessionStorage
    this.loadUserFromSession();
    
    // Suscribirse a cambios futuros
    this.userDataService.userData$.subscribe((userData: UserData | null) => {
      if (userData) {
        this.userName = userData.name;
        this.userEmail = userData.email;
        this.userRolDescription = userData.rolDescription;
        this.userRole = userData.rol;
        this.userImage = userData.image;
      } else {
        this.loadUserFromSession();
      }
    });
  }

  private loadUserFromSession(): void {
    if (typeof window !== 'undefined') {
      // Construir el nombre igual que en Authoriza
      const firstName = sessionStorage.getItem('user_firstName');
      const secondName = sessionStorage.getItem('user_secondName');
      const lastName = sessionStorage.getItem('user_lastName');
      const businessName = sessionStorage.getItem('user_businessName');
      const userName = sessionStorage.getItem('user_name');
      const userEmail = sessionStorage.getItem('user_email');
      
      // Si user_name es igual al email o contiene @, no lo usamos
      const fallbackName = (userName && userName !== userEmail && !userName.includes('@')) ? userName : 'Usuario';
      
      // Concatenar nombre y apellido si llegan
      const fullName = [firstName, secondName, lastName].filter(Boolean).join(' ');
      
      this.userName = businessName
        ? businessName
        : fullName || fallbackName;
      
      this.userEmail = userEmail || '';
      this.userRolDescription = sessionStorage.getItem('user_rolDescription') || sessionStorage.getItem('user_rol') || 'Usuario';
      this.userRole = sessionStorage.getItem('user_rol') || 'Usuario';
      this.userImage = sessionStorage.getItem('user_image') || undefined;
    }
  }

  loadNotifications(): void {
    this.dashboardService.getDashboardMetrics().subscribe({
      next: (metrics: DashboardMetrics) => {
        this.notifications = [];
        if (metrics.pendingInvoices > 0) {
          this.notifications.push({ container: 0, title: `${metrics.pendingInvoices} Facturas pendientes`, type: 'warning', visible: true });
        }
        if (metrics.paidInvoices > 0) {
          this.notifications.push({ container: 0, title: `${metrics.paidInvoices} Facturas pagadas`, type: 'success', visible: true });
        }
      },
      error: (error) => {
        this.notifications = [];
      }
    });
  }

  toggleToolbox(event: Event) {
    event.preventDefault();

    // Solo en mobile controlamos con click
    if (this.isMobile) {
      this.showToolbox = !this.showToolbox;
    }

    // En desktop NO hacemos nada porque funciona con hover
  }

  // Métodos de herramientas del desplegable
  openCalculator() {
    // Funcionalidad de calculadora
  }
  
  openSettings() {
    // Funcionalidad de configuración
  }

  async openChangePasswordModal(): Promise<void> {
    if (typeof window !== 'undefined') {
      const modalElement = document.getElementById('changePasswordModal');
      if (modalElement) {
        const bootstrap = await import('bootstrap');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }
    }
  }

  trackByOptionId(index: number, option: OptionMenu): string {
    return option.id || index.toString();
  }
  
  getSelectedMenuDescription(): string {
    const currentUrl = this.router.url;
    const selectedOption = this.optionsMenu.find(option => option.url === currentUrl);
    return selectedOption?.description || selectedOption?.name || '';
  }
}
