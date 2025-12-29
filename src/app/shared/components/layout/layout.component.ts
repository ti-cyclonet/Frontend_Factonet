import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { RouterModule, Router } from '@angular/router'; 
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { ParametrosGlobalesService } from '../../services/parametros-globales/parametros-globales.service';
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

  constructor(
    private applicationsService: ApplicationsService,
    private parametrosService: ParametrosGlobalesService,
    private router: Router
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.fetchApplication(NAME_APP_SHORT);
    this.checkActivePeriod();
  }

  fetchApplication(name: string): void {
    const userRol = sessionStorage.getItem('user_rol');
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
  
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

        // Ordenar por ingOrder numérico
        this.optionsMenu.sort((a, b) => parseInt(a.order) - parseInt(b.order));

        if (this.optionsMenu.length === 0) {
          // Si no hay opciones del backend, no cargar menú estático
          this.optionsMenu = [];
        }
      },
      error: (err) => {
        // En caso de error, no cargar menú estático
        this.optionsMenu = [];
      }
    });
  }



  checkActivePeriod(): void {
    if (!this.isUserLoggedIn()) return;
    
    this.parametrosService.getPeriodos().subscribe({
      next: (periodos) => {
        const periodoActivo = periodos.find(p => p.status === 'ACTIVE');
        if (!periodoActivo) {
          Swal.fire({
            title: 'Sin período activo',
            text: 'No existe un período activo. Debe crear y activar un período para continuar.',
            icon: 'warning',
            confirmButtonText: 'Ir a Parámetros Globales',
            allowOutsideClick: false
          }).then(() => {
            this.router.navigate(['/parametros-globales']);
          });
        }
      },
      error: () => {
        // Si hay error, asumir que no hay períodos
        Swal.fire({
          title: 'Sin períodos configurados',
          text: 'Debe crear y activar un período para continuar.',
          icon: 'warning',
          confirmButtonText: 'Ir a Parámetros Globales',
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