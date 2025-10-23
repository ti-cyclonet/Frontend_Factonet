import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LoginDTO } from '../../model/login';
import { NAME_APP_SHORT } from '../../../config/config';
import { NotificationsComponent } from "../notifications/notifications.component";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NotificationsComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @ViewChild('notification') notification!: NotificationsComponent;
  loginForm: FormGroup;
  loginDTO: LoginDTO | undefined;
  submitted = false;
  isVisible: boolean = true;
  errorMessage = '';

  // configuración notificaciones tipo toast
    toastTitle: string = '';
    toastType: 'success' | 'warning' | 'danger' | 'primary' = 'success';
    notifications: Array<{
      title: string;
      type: 'success' | 'warning' | 'danger' | 'primary';
      alertType: 'A' | 'B';
      container: 0 | 1;
      visible: boolean;
    }> = [];
    SWNTF: number = 0;
  // ----------------------------------------------

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService, 
    private cdr: ChangeDetectorRef,
  ) {
    this.notifications = [];
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]], 
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.loginDTO = {
      applicationName: '', 
      email: '',
      password: ''
    };
  }

    // ----------------------------------------------
    // ¡NUEVA UBICACIÓN DE LAS FUNCIONES DE NOTIFICACIÓN!
    // ----------------------------------------------
    
    // Funciones para NOTIFICACIONES
    addNotification(title: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
      this.notifications.push({ title, type, alertType, container, visible: true });
    }

    removeNotification(index: number) {
      this.notifications.splice(index, 1);
    }
  
    showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B',  container: 0 | 1 ) {
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
    // ----------------------------------------------


  get f() {
    return this.loginForm.controls;
  }

  onSubmit() {
  
    // *** SIMULAR AUTENTICACIÓN EXITOSA Y NAVEGAR DIRECTAMENTE ***
    
    // 1. Simular la obtención de un token (opcional, pero recomendado si el resto de la app lo verifica)
    sessionStorage.setItem('token', 'TOKEN_DE_BYPASS_PARA_VER_UI'); 
    
    // 2. Mostrar la notificación de éxito (ahora llama a la función reubicada)
    this.showToast('Bypass de sesión exitoso. Cargando UI...', 'success', 'A', 0);
    
    // 3. Navegar directamente a la página principal después de un pequeño retraso
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 1000);

    // ... (El resto del código de login COMENTADO/ELIMINADO sigue aquí)
  }
}