import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class ParametrosGlobalesService {
  private apiUrl = `${environment.authorizaApiUrl}`;

  constructor(private http: HttpClient) {}

  getPeriodos(): Observable<any[]> {
    const hoy = new Date();
    const mockPeriodos = [
      { id: '2', nombre: '2025-Actual', fechaInicio: '2025-11-01', fechaFin: '2026-01-31', activo: this.esPeriodoActivo('2025-11-01', '2026-01-31', hoy) },
      { id: '1', nombre: '2025-Q2', fechaInicio: '2025-04-01', fechaFin: '2025-06-30', activo: this.esPeriodoActivo('2025-04-01', '2025-06-30', hoy) },
      { id: '3', nombre: '2024-Q4', fechaInicio: '2024-10-01', fechaFin: '2024-11-30', activo: this.esPeriodoActivo('2024-10-01', '2024-11-30', hoy) }
    ];
    return of(mockPeriodos);
  }

  private esPeriodoActivo(fechaInicio: string, fechaFin: string, fechaActual: Date): boolean {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    return fechaActual >= inicio && fechaActual <= fin;
  }

  getPeriodoActivo(): Observable<any> {
    const mockPeriodoActivo = { id: '1', nombre: '2024-Q1', fechaInicio: '2024-01-01', fechaFin: '2024-03-31' };
    return of(mockPeriodoActivo);
  }

  crearPeriodo(periodo: any): Observable<any> {
    console.log('Crear período:', periodo);
    return of({ success: true });
  }

  activarPeriodo(periodoId: string): Observable<any> {
    console.log('Activar período:', periodoId);
    return of({ success: true });
  }

  getParametrosGlobales(): Observable<any[]> {
    const mockParametros = [
      { id: '1', nombre: 'IVA', valor: 19, descripcion: 'Impuesto al Valor Agregado', mostrarEnDocs: true },
      { id: '2', nombre: 'Margen de Ganancia', valor: 15, descripcion: 'Porcentaje de margen de ganancia', mostrarEnDocs: false },
      { id: '3', nombre: 'Interés Financiero', valor: 5, descripcion: 'Interés de financiamiento', mostrarEnDocs: true },
      { id: '4', nombre: 'Descuento Comercial', valor: 8, descripcion: 'Descuento por volumen', mostrarEnDocs: false },
      { id: '5', nombre: 'Comisión Bancaria', valor: 3, descripcion: 'Comisión por transacción', mostrarEnDocs: true },
      { id: '6', nombre: 'Seguro', valor: 2, descripcion: 'Seguro de mercancía', mostrarEnDocs: false },
      { id: '7', nombre: 'Transporte', valor: 4, descripcion: 'Costo de transporte', mostrarEnDocs: true },
      { id: '8', nombre: 'Almacenamiento', valor: 1.5, descripcion: 'Costo de almacenamiento', mostrarEnDocs: false },
      { id: '9', nombre: 'Manejo', valor: 2.5, descripcion: 'Costo de manejo', mostrarEnDocs: true },
      { id: '10', nombre: 'Administración', valor: 6, descripcion: 'Gastos administrativos', mostrarEnDocs: false },
      { id: '11', nombre: 'Marketing', valor: 3.5, descripcion: 'Gastos de marketing', mostrarEnDocs: true },
      { id: '12', nombre: 'Contingencia', valor: 1, descripcion: 'Fondo de contingencia', mostrarEnDocs: false }
    ];
    return of(mockParametros);
  }

  guardarParametros(parametros: any[]): Observable<any> {
    console.log('Guardar parámetros:', parametros);
    return of({ success: true });
  }

  getParametrosPorPeriodo(periodoId: string): Observable<any[]> {
    const mockParametrosPorPeriodo: { [key: string]: any[] } = {
      '1': [
        { id: '1', nombre: 'IVA', valor: 19, descripcion: 'Impuesto al Valor Agregado Q1' },
        { id: '2', nombre: 'Margen de Ganancia', valor: 15, descripcion: 'Porcentaje de margen Q1' },
        { id: '3', nombre: 'Interés Financiero', valor: 5, descripcion: 'Interés de financiamiento Q1' }
      ],
      '2': [
        { id: '1', nombre: 'IVA', valor: 21, descripcion: 'Impuesto al Valor Agregado Q2' },
        { id: '2', nombre: 'Margen de Ganancia', valor: 18, descripcion: 'Porcentaje de margen Q2' },
        { id: '3', nombre: 'Interés Financiero', valor: 7, descripcion: 'Interés de financiamiento Q2' }
      ],
      '3': [
        { id: '1', nombre: 'IVA', valor: 20, descripcion: 'Impuesto al Valor Agregado Q3' },
        { id: '2', nombre: 'Margen de Ganancia', valor: 12, descripcion: 'Porcentaje de margen Q3' },
        { id: '3', nombre: 'Interés Financiero', valor: 6, descripcion: 'Interés de financiamiento Q3' }
      ]
    };
    return of(mockParametrosPorPeriodo[periodoId] || []);
  }
  
  eliminarPeriodo(periodoId: string): Observable<any> {
    console.log('Eliminar período:', periodoId);
    return of({ success: true });
  }
}