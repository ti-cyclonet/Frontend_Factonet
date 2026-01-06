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
  crearSubperiodo(data: any): Observable<any> { 
    return this.http.post(`${this.authorizaUrl}/api/periods/subperiods`, data);
  }
  crearParametroGlobal(data: any): Observable<any> { 
    return this.http.post(`${this.authorizaUrl}/api/periods/global-parameters`, data);
  }
  crearPeriodo(data: any): Observable<any> { 
    return this.http.post(`${this.authorizaUrl}/api/periods`, data);
  }
  eliminarParametroDePeriodo(id: string): Observable<any> { 
    return this.http.delete(`${this.authorizaUrl}/api/global-parameters-periods/${id}`);
  }
  eliminarPeriodo(id: string): Observable<any> { 
    return this.http.delete(`${this.authorizaUrl}/api/periods/${id}`);
  }
  activarPeriodo(id: string): Observable<any> { 
    return this.http.patch(`${this.authorizaUrl}/api/periods/${id}/activate`, {});
  }
  getParametrosDisponibles(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.authorizaUrl}/api/periods/global-parameters`);
  }
  agregarParametrosAPeriodo(periodoId: string, params: any[]): Observable<any> { 
    return this.http.post(`${this.authorizaUrl}/api/periods/${periodoId}/parameters`, { parametros: params });
  }
  getParametrosPorPeriodo(id: string): Observable<any[]> { 
    return this.http.get<any[]>(`${this.authorizaUrl}/api/periods/${id}/parameters`);
  }
  actualizarEstadoParametro(id: string, estado: string): Observable<any> { 
    return this.http.patch(`${this.authorizaUrl}/api/global-parameters-periods/${id}`, { status: estado });
  }
  desactivarPeriodo(id: string): Observable<any> { 
    return this.http.patch(`${this.authorizaUrl}/api/periods/${id}/deactivate`, {});
  }
  actualizarValorParametro(id: string, valor: string): Observable<any> { 
    return this.http.patch(`${this.authorizaUrl}/api/global-parameters-periods/${id}`, { value: valor });
  }
  actualizarOperationTypeParametro(id: string, operationType: string): Observable<any> { 
    return this.http.patch(`${this.authorizaUrl}/api/global-parameters-periods/${id}`, { operationType });
  }
  actualizarMostrarEnDocs(id: string, mostrar: boolean): Observable<any> { return of(null); }
}