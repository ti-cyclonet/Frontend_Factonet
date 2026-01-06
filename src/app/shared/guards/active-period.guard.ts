import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ParametrosGlobalesService } from '../services/parametros-globales/parametros-globales.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ActivePeriodGuard implements CanActivate {

  constructor(
    private parametrosService: ParametrosGlobalesService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.parametrosService.getPeriodos().pipe(
      map(periodos => {
        const periodoActivo = periodos.find(p => p.status === 'ACTIVE');
        
        if (!periodoActivo) {
          Swal.fire({
            title: 'No Active Period',
            text: 'You must have an active period to access this module.',
            icon: 'warning',
            confirmButtonText: 'Go to Periods',
            allowOutsideClick: false
          }).then(() => {
            this.router.navigate(['/parametros-globales']);
          });
          return false;
        }

        // Validar vigencia del periodo activo
        const fechaActual = new Date();
        const fechaFin = new Date(periodoActivo.endDate);
        
        if (fechaFin < fechaActual) {
          Swal.fire({
            title: 'Expired Period',
            text: `The active period "${periodoActivo.name}" has expired. You must activate a valid period to continue.`,
            icon: 'error',
            confirmButtonText: 'Go to Periods',
            allowOutsideClick: false
          }).then(() => {
            this.router.navigate(['/parametros-globales']);
          });
          return false;
        }
        
        return true;
      }),
      catchError(() => {
        Swal.fire({
          title: 'No Periods Configured',
          text: 'You must create and activate a period to access this module.',
          icon: 'warning',
          confirmButtonText: 'Go to Periods',
          allowOutsideClick: false
        }).then(() => {
          this.router.navigate(['/parametros-globales']);
        });
        return of(false);
      })
    );
  }
}