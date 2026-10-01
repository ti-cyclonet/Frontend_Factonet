import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of, forkJoin } from 'rxjs';
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
    return forkJoin({
      periodoActivo: this.parametrosService.getPeriodoActivo(),
      parametrosGlobales: this.parametrosService.getParametrosActivosPeriodo(),
      parametrosFacturas: this.parametrosService.getParametrosFacturas()
    }).pipe(
      map(({ periodoActivo, parametrosGlobales, parametrosFacturas }) => {
        if (!periodoActivo) {
          this.showError('No hay periodo activo', 'Necesitas un periodo activo para entrar a este módulo.');
          return false;
        }

        // Validar vigencia del periodo activo
        const fechaActual = new Date();
        const fechaFin = new Date(periodoActivo.endDate);
        
        if (fechaFin < fechaActual) {
          this.showError('Periodo vencido', `El periodo activo "${periodoActivo.name}" ya venció. Activa un periodo vigente para continuar.`);
          return false;
        }

        // Validar parámetros globales configurados
        if (!parametrosGlobales || parametrosGlobales.length === 0) {
          this.showError('Faltan los parámetros globales', 'Configura los parámetros globales del periodo activo para entrar a este módulo.');
          return false;
        }

        // Validar parámetros de facturas configurados
        if (!parametrosFacturas || parametrosFacturas.length === 0) {
          this.showError('Faltan los parámetros de facturas', 'Configura los parámetros de facturas para entrar a este módulo.');
          return false;
        }
        
        return true;
      }),
      catchError(() => {
        this.showError('Error de configuración', 'No se pudo verificar la configuración del sistema. Revisa la configuración.');
        return of(false);
      })
    );
  }

  private showError(title: string, text: string): void {
    // Solo adminFactonet puede configurar periodos/parámetros — el resto de
    // clientes se rige por lo que él configure y no puede resolver esto por
    // su cuenta (el backend además ya les bloquea el módulo de Configuración).
    const isAdmin = (typeof window !== 'undefined' && sessionStorage.getItem('user_rol')) === 'adminFactonet';

    if (!isAdmin) {
      Swal.fire({
        title,
        text: `${text} Contacta al administrador de FactoNet para que lo configure.`,
        icon: 'warning',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false
      });
      return;
    }

    Swal.fire({
      title,
      text,
      icon: 'warning',
      confirmButtonText: 'Ir a Configuración',
      allowOutsideClick: false
    }).then(() => {
      this.router.navigate(['/parametros-globales']);
    });
  }
}