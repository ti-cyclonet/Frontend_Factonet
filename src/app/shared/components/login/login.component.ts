import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LoginDTO } from '../../model/login';
import { NAME_APP_SHORT } from '../../../config/config';
import { NotificationsComponent } from "../notifications/notifications.component";

interface ClientContract {
  contractId: string;
  clientName: string;
  packageName: string;
}

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

  // Selector de cliente
  showClientSelector: boolean = false;
  availableContracts: ClientContract[] = [];
  selectedContractId: string = '';

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
  
    showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B',  container: 0 | 1 ) {
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
    this.submitted = true;
    
    if (this.loginForm.invalid) {
      this.showToast('Por favor complete todos los campos correctamente', 'danger', 'A', 0);
      return;
    }

    const credentials = {
      email: this.loginForm.value.username,
      password: this.loginForm.value.password,
      applicationName: NAME_APP_SHORT
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        // Caso multi-contrato: el backend retorna contracts[] sin token
        if (response.contracts && response.contracts.length > 1) {
          this.availableContracts = response.contracts;
          this.showClientSelector = true;
          this.cdr.detectChanges();
          return;
        }

        this.showToast('Login successful', 'success', 'A', 0);
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 1000);
      },
      error: (error) => {
        this.showToast('Invalid credentials or server error', 'danger', 'A', 0);
      }
    });
  }

  selectClient() {
    if (!this.selectedContractId) {
      this.showToast('Please select a client', 'warning', 'A', 0);
      return;
    }

    // Guardar el nombre del cliente seleccionado
    const selectedContract = this.availableContracts.find(c => c.contractId === this.selectedContractId);
    if (selectedContract) {
      sessionStorage.setItem('selected_client_name', selectedContract.clientName);
      sessionStorage.setItem('selected_package_name', selectedContract.packageName || '');
    }

    const completeLoginDTO = {
      email: this.loginForm.get('username')?.value,
      applicationName: NAME_APP_SHORT,
      contractId: this.selectedContractId
    };

    this.authService.completeLogin(completeLoginDTO).subscribe({
      next: (response) => {
        this.showClientSelector = false;
        this.showToast('Login successful', 'success', 'A', 0);
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 1000);
      },
      error: (error) => {
        this.showToast('Error selecting client', 'danger', 'A', 0);
      }
    });
  }
}
