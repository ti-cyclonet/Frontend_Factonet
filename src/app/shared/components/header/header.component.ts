import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common'; 
import { Router, RouterModule } from '@angular/router'; 
import { OptionMenu } from '../../model/option_menu'; 
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; 
// import { NotificationsComponent } from '../notifications/notifications.component'; // Se asume que esta línea ya se ha limpiado o eliminado por el error anterior

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

  // Métodos de herramientas del desplegable

  openCalculator() {
    // Lógica para abrir la CALCULADORA
    console.log('Abriendo calculadora desde el menú de herramientas...');
  }
  
  // ¡ELIMINADO!: Se ha quitado el método openCalendar().

  openSettings() {
    // Lógica para la opción 'Configuración Avanzada' dentro del menú.
    console.log('Abriendo configuración avanzada...');
  }
}