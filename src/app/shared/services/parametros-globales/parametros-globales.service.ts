import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class ParametrosGlobalesService {
  private apiUrl = `${environment.BASE_URL_FACTONET}`;

  constructor(private http: HttpClient) {}

  getPeriodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/periods`);
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

  getParametrosDisponibles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/periods/global-parameters`);
  }

  agregarParametrosAPeriodo(periodoId: string, parametros: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/periods/${periodoId}/parameters`, { parametros });
  }

  validateParameterName(name: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/api/periods/global-parameters/validate-name?name=${encodeURIComponent(name)}`);
  }

  crearParametroGlobal(parametro: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/periods/global-parameters`, parametro);
  }

  crearPeriodo(periodo: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/periods`, periodo);
  }

  activarPeriodo(periodoId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/periods/${periodoId}/activate`, {});
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

    return of({ success: true });
  }

  getParametrosPorPeriodo(periodoId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/periods/${periodoId}/parameters`);
  }
  
  actualizarEstadoParametro(parametroId: string, estado: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/global-parameters-periods/${parametroId}`, { status: estado });
  }
  
  actualizarValorParametro(parametroId: string, valor: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/global-parameters-periods/${parametroId}`, { value: valor });
  }
  
  actualizarMostrarEnDocs(parametroId: string, mostrarEnDocs: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/api/global-parameters-periods/${parametroId}`, { showInDocs: mostrarEnDocs });
  }
  
  eliminarParametroDePeriodo(parametroId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/global-parameters-periods/${parametroId}`);
  }
  
  eliminarPeriodo(periodoId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/periods/${periodoId}`);
  }
}