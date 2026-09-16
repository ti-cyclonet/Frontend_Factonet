import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { UserService } from "../../services/user/user.service";
import Swal from "sweetalert2";

@Component({
  standalone: true,
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
  imports: [ReactiveFormsModule, CommonModule, FormsModule]
})
export class ChangePasswordComponent implements OnInit {
  /** Modo obligatorio: el usuario tiene la marca mustChangePassword activa. */
  @Input() forced = false;
  @Output() changed = new EventEmitter<void>();

  form!: FormGroup;
  saving = false;
  showOldPassword = false;
  showNewPassword = false;
  showRepeatPassword = false;

  constructor(private fb: FormBuilder, private usersService: UserService) {}

  ngOnInit() {
    this.form = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      repeatPassword: ['', Validators.required],
    });
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'repeat'): void {
    if (field === 'old') this.showOldPassword = !this.showOldPassword;
    if (field === 'new') this.showNewPassword = !this.showNewPassword;
    if (field === 'repeat') this.showRepeatPassword = !this.showRepeatPassword;
  }

  get passwordsMismatch(): boolean {
    const repeat = this.form.get('repeatPassword');
    return !!repeat?.value && repeat.value !== this.form.get('newPassword')?.value;
  }

  get passwordsMatch(): boolean {
    const repeat = this.form.get('repeatPassword');
    return !!repeat?.value && repeat.value === this.form.get('newPassword')?.value;
  }

  onSubmit() {
    if (this.form.invalid || this.passwordsMismatch) {
      this.form.markAllAsTouched();
      return;
    }

    const { oldPassword, newPassword } = this.form.value;
    const userId = sessionStorage.getItem('user_id');
    if (!userId) {
      Swal.fire('Error', 'No se pudo identificar tu sesión. Vuelve a iniciar sesión.', 'error');
      return;
    }

    this.saving = true;
    this.usersService.changePassword(userId, oldPassword, newPassword)
      .subscribe({
        next: () => {
          this.saving = false;
          sessionStorage.setItem('must_change_password', 'false');
          Swal.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 1800, showConfirmButton: false });
          this.form.reset();
          this.changed.emit();
        },
        error: (err: any) => {
          this.saving = false;
          Swal.fire('Error', err?.error?.message || 'No se pudo actualizar la contraseña', 'error');
        }
      });
  }
}
