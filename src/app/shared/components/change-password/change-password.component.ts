import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UserService } from '../../services/user/user.service';
import Swal from 'sweetalert2';

@Component({
  standalone: true,
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
})
export class ChangePasswordComponent implements OnInit {
  @Output() passwordChanged = new EventEmitter<void>();
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      repeatPassword: ['', Validators.required],
    });
  }

  closeModal(): void {
    if (typeof window !== 'undefined') {
      const modalElement = document.getElementById('changePasswordModal');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    }
  }

  onSubmit(): void {
    if (
      this.form.valid &&
      this.form.get('newPassword')?.value ===
        this.form.get('repeatPassword')?.value
    ) {
      const userId =
        sessionStorage.getItem('user_id') || localStorage.getItem('userId');
      const { oldPassword, newPassword } = this.form.value;

      this.userService.changePassword(userId!, oldPassword, newPassword).subscribe({
        next: (res) => {
          Swal.fire({
            icon: 'success',
            title: 'Password updated!',
            text: res.message || 'Your password has been successfully changed.',
            confirmButtonColor: '#3085d6',
          });
          this.form.reset();
          this.closeModal();
        },
        error: (err: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error changing password',
            text: err.error?.message || 'An unexpected error occurred.',
            confirmButtonColor: '#d33',
          });
        },
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Passwords do not match',
        text: 'The new password and its repetition do not match.',
        confirmButtonColor: '#f0ad4e',
      });
    }
  }
}