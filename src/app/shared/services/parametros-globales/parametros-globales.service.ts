import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ParametrosGlobalesService {
  private authorizaUrl = 'http://localhost:3003'; // URL del backend FactoNet

  constructor(private http: HttpClient) {}

  async getParametrosActivosPeriodo(): Promise<any[]> {
    const response = await this.http.get<any[]>(`${this.authorizaUrl}/api/global-parameters-periods/active`).toPromise();
    return response || [];
  }

  async getParametrosFacturas(): Promise<any[]> {
    const response = await this.http.get<any[]>(`${this.authorizaUrl}/api/global-parameters-for-invoices`).toPromise();
    return response || [];
  }

  async guardarParametrosFacturas(parametros: any[]): Promise<any> {
    return this.http.post(`${this.authorizaUrl}/api/global-parameters-for-invoices/bulk`, parametros).toPromise();
  }

  // Métodos temporales para evitar errores de compilación
  getPeriodos(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.authorizaUrl}/api/periods`);
  }
  getPeriodoActivo(): Observable<any> { return of(null); }
  getParametrosGlobales(): Observable<any[]> { return of([]); }
  guardarParametros(params: any): Observable<any> { return of(null); }
  validateParameterName(name: string): Observable<boolean> { return of(false); }
  crearSubperiodo(data: any): Observable<any> { return of(null); }
  crearParametroGlobal(data: any): Observable<any> { return of(null); }
  crearPeriodo(data: any): Observable<any> { return of(null); }
  eliminarParametroDePeriodo(id: string): Observable<any> { return of(null); }
  eliminarPeriodo(id: string): Observable<any> { return of(null); }
  activarPeriodo(id: string): Observable<any> { return of(null); }
  getParametrosDisponibles(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.authorizaUrl}/api/periods/global-parameters`);
  }
  agregarParametrosAPeriodo(periodoId: string, params: any[]): Observable<any> { return of(null); }
  getParametrosPorPeriodo(id: string): Observable<any[]> { 
    return this.http.get<any[]>(`${this.authorizaUrl}/api/periods/${id}/parameters`);
  }
  actualizarEstadoParametro(id: string, estado: string): Observable<any> { return of(null); }
  desactivarPeriodo(id: string): Observable<any> { return of(null); }
  actualizarValorParametro(id: string, valor: string): Observable<any> { return of(null); }
  actualizarMostrarEnDocs(id: string, mostrar: boolean): Observable<any> { return of(null); }
}