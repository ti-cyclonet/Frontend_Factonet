import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ParametrosGlobalesComponent } from './parametros-globales.component';
import { ParametrosFacturasComponent } from '../parametros-facturas/parametros-facturas.component';

/** Pantallas de configuración del administrador: que se arman con sus dependencias. */
describe('Pantallas de parámetros', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParametrosGlobalesComponent, ParametrosFacturasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('parámetros globales', () => {
    const fixture = TestBed.createComponent(ParametrosGlobalesComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('parámetros de facturas', () => {
    const fixture = TestBed.createComponent(ParametrosFacturasComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
