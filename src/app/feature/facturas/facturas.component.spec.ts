import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import Swal from 'sweetalert2';

import { FacturasComponent } from './facturas.component';

describe('FacturasComponent', () => {
  let component: FacturasComponent;
  let fixture: ComponentFixture<FacturasComponent>;
  let http: HttpTestingController;

  const crear = (rol: string | null) => {
    if (rol) sessionStorage.setItem('user_rol', rol); else sessionStorage.removeItem('user_rol');
    fixture = TestBed.createComponent(FacturasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => sessionStorage.removeItem('user_rol'));

  it('should create', () => {
    crear(null);
    expect(component).toBeTruthy();
  });

  it('el cliente consulta si la pasarela está activa; si responde false, queda apagada', () => {
    crear('adminInvoices');
    http.expectOne(r => r.url.endsWith('/pagos/configuracion')).flush({ pasarelaActiva: false, proveedor: null });
    expect(component.pasarelaActiva).toBeFalse();
  });

  it('si la consulta falla, la pasarela queda apagada (solo "Reportar pago")', () => {
    crear('adminInvoices');
    http.expectOne(r => r.url.endsWith('/pagos/configuracion')).flush('x', { status: 500, statusText: 'Error' });
    expect(component.pasarelaActiva).toBeFalse();
  });

  it('el administrador no consulta la pasarela', () => {
    crear('adminFactonet');
    http.expectNone(r => r.url.endsWith('/pagos/configuracion'));
  });

  it('con la pasarela apagada, pagar abre directamente el reporte con constancia', () => {
    crear('adminInvoices');
    const reporte = spyOn(component, 'payInvoice');
    const dialogo = spyOn(Swal, 'fire');
    component.pasarelaActiva = false;
    component.pagarFactura({ id: 1, numero: 'DF1', total: 100 } as any);
    expect(reporte).toHaveBeenCalled();
    expect(dialogo).not.toHaveBeenCalled();
  });

  it('con la pasarela activa, pagar deja elegir entre pagar en línea y reportar', async () => {
    crear('adminInvoices');
    const dialogo = spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false, isDenied: true } as any));
    const reporte = spyOn(component, 'payInvoice');
    component.pasarelaActiva = true;
    component.pagarFactura({ id: 1, numero: 'DF1', total: 100 } as any);
    expect((dialogo.calls.mostRecent().args[0] as any).confirmButtonText).toBe('Pagar en línea');
    await Promise.resolve();
    expect(reporte).toHaveBeenCalled();
  });
});
