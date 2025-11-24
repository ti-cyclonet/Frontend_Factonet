import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { RouterModule } from '@angular/router'; 
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { NAME_APP_SHORT } from '../../../config/config';


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

  constructor(
    private applicationsService: ApplicationsService
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.fetchApplication(NAME_APP_SHORT);
  }

  /**
   * Intenta obtener la configuración de la aplicación desde la API.
   * Si falla (API no disponible o rol no encontrado), carga menús estáticos.
   */
  fetchApplication(name: string): void {
    const userRol = sessionStorage.getItem('user_rol');
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    
    // Si no hay token o rol, cargar menús estáticos
    if (!token || !userRol) {
      console.warn('Advertencia: Token o rol de usuario no encontrado. Cargando menús estáticos.');
      this.loadStaticMenu();
      return;
    }
  
    this.applicationsService.getApplicationByNameAndRol(name, userRol).subscribe({
      next: (app) => {
        if (!app) {
          console.error('Aplicación no encontrada. Cargando menús estáticos.');
          this.loadStaticMenu();
          return;
        }
  
        this.application = app;
        
        // Lógica de mapeo original
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
        
        // Si no hay menús del backend, usar estáticos como fallback
        if (this.optionsMenu.length === 0) {
          this.loadStaticMenu();
        }
      },
      error: (err) => {
        console.error('Error fetching application (API no disponible). Cargando menús estáticos:', err);
        this.loadStaticMenu(); // Llama a la función estática en caso de error de la API
      }
    });
  }

  /**
   * Carga un conjunto de opciones de menú por defecto para el desarrollo.
   */
  private loadStaticMenu(): void {
    this.optionsMenu = [
      { 
      name: 'Contratos', 
      url: '/contracts', 
      icon: 'journal-richtext',
      type: 'main_menu',
      id: '3', description: '', idMPather: null, order: '1', idApplication: ''
    },
    { 
      name: 'Facturas', 
      url: '/invoices', 
      icon: 'file-earmark-text',
      type: 'main_menu',
      id: '2', description: '', idMPather: null, order: '2', idApplication: ''
    },
    ].sort((a, b) => (a.order > b.order ? 1 : -1)); // Ordenar por 'order' si lo deseas
  }


  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }
}