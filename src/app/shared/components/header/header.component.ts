import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common'; 
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
export class HeaderComponent implements OnInit {
  
  @Input() optionsMenu: OptionMenu[] = []; 
  
  // PROPIEDADES 
  nombreApp: string = 'FactoNET'; 
  userImage: string | undefined = undefined; 
  userRolDescription: string = 'Administrador'; 
  userEmail: string = 'ajmamby@factonet.com'; 
  form: any; 
  notifications: any[] = []; 
    
  // Propiedades originales
  userName: string = 'AJMAMBY'; 
  userRole: string = 'Administrador'; 

  // Controla la visibilidad de la caja de herramientas deslizable
  showToolbox: boolean = false; 

  constructor(private router: Router) { 
    }

  ngOnInit(): void {
    // Inicialización si es necesario
  }
  
  // MÉTODOS
  
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

  // MÉTODO MODIFICADO: Previene la navegación del enlace y cambia el estado.
  toggleToolbox(event: Event) {
    // Es crucial prevenir el comportamiento por defecto para que el enlace no navegue
    // a '#' y anule el evento de clic.
    event.preventDefault(); 
    
    // Cambiar el estado
    this.showToolbox = !this.showToolbox;
  }

  // Métodos de herramientas del desplegable

  openCalculator() {
    // Lógica para abrir la CALCULADORA
    console.log('Abriendo calculadora desde el menú de herramientas...');
  }
  
  openSettings() {
    // Lógica para la opción 'Configuración Avanzada' dentro del menú.
    console.log('Abriendo configuración avanzada...');
  }
}
