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
            title: 'Sin período activo',
            text: 'Debe tener un período activo para acceder a este módulo.',
            icon: 'warning',
            confirmButtonText: 'Ir a Parámetros Globales',
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
          title: 'Sin períodos configurados',
          text: 'Debe crear y activar un período para acceder a este módulo.',
          icon: 'warning',
          confirmButtonText: 'Ir a Parámetros Globales',
          allowOutsideClick: false
        }).then(() => {
          this.router.navigate(['/parametros-globales']);
        });
        return of(false);
      })
    );
  }
}