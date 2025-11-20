import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { Router, RouterModule } from '@angular/router'; 
import { OptionMenu } from '../../model/option_menu'; 
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; 

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,     
    RouterModule,     
    FormsModule,      
    ReactiveFormsModule, 
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  dropdownOpen: boolean = false;
  private resizeListener: any;

  @Input() optionsMenu: OptionMenu[] = []; 
  
  // PROPIEDADES 
  nombreApp: string = 'FactoNET'; 
  userImage: string | undefined = undefined; 
  userRolDescription: string = 'Administrador'; 
  userEmail: string = 'ajmamby@factonet.com'; 
  form: any; 
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    container: 0 | 1;
    visible: boolean;
  }> = []; 
    
  // Propiedades originales
  userName: string = 'AJMAMBY'; 
  userRole: string = 'Administrador'; 

  // Controla la visibilidad de la caja de herramientas deslizable
  showToolbox: boolean = false; 

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.checkScreenSize();
    console.log('isMobile inicial:', this.isMobile);
    // Crea notificaciones del sistema basadas en las métricas del footer
  this.notifications = [
    { container: 0, title: '7 Facturas pendientes', type: 'warning', visible: true },
    { container: 0, title: '42 Facturas pagadas', type: 'success', visible: true }
  ];
  console.log('mobileNotifications:', this.mobileNotifications);

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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user_rol');
    this.router.navigate(['/login']); 
  }

  onSubmit() {
    console.log('Intentando actualizar la contraseña...');
  }

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
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
    console.log('Abriendo calculadora desde el menú de herramientas...');
  }
  
  openSettings() {
    console.log('Abriendo configuración avanzada...');
 
 }
}
