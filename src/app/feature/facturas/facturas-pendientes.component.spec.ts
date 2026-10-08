import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FacturasPendientesComponent } from './facturas-pendientes.component';

const hoy = new Date();
const iso = (dias: number) => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const facturas = [
  { id: 1, numero: 'DF00001', cliente: 'Cliente A', estado: 'In arrears', fechaVencimiento: iso(-5), total: 100000 },
  { id: 2, numero: 'DF00002', cliente: 'Cliente A', estado: 'Issued', fechaVencimiento: iso(10), total: 50000 },
  { id: 3, numero: 'DF00003', cliente: 'Cliente <b>B</b>', estado: 'Payment Reported', fechaVencimiento: iso(2), total: 70000, fechaPago: iso(-1) },
  { id: 4, numero: 'DF00004', cliente: 'Cliente A', estado: 'Paid', fechaVencimiento: iso(-40), total: 90000 },
];

describe('FacturasPendientesComponent', () => {
  let fixture: ComponentFixture<FacturasPendientesComponent>;
  let el: HTMLElement;

  const montar = (rol: string) => {
    fixture = TestBed.createComponent(FacturasPendientesComponent);
    fixture.componentInstance.facturas = facturas as any;
    fixture.componentInstance.rol = rol;
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    el = fixture.nativeElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FacturasPendientesComponent] }).compileComponents();
  });

  it('cliente: total por pagar, vencidas y una tarjeta por factura pendiente, la vencida primero', () => {
    montar('adminInvoices');
    expect(el.querySelector('.fp-total')?.textContent).toContain('150.000');
    expect(el.querySelector('.fp-chip-peligro')?.textContent).toContain('1 vencida');
    const numeros = Array.from(el.querySelectorAll('.fp-card .fp-numero')).map(n => n.textContent);
    expect(numeros).toEqual(['DF00001', 'DF00002']);
    expect(el.querySelector('.fp-vencida .fp-vence')?.textContent).toContain('Vencida hace 5 días');
    expect(el.querySelector('.fp-verificacion')?.textContent).toContain('DF00003');
  });

  it('cliente: el botón de pago emite la factura', () => {
    montar('adminInvoices');
    let emitida: any = null;
    fixture.componentInstance.pagar.subscribe((f: any) => (emitida = f));
    (el.querySelector('.fp-card .fp-btn') as HTMLButtonElement).click();
    expect(emitida?.id).toBe(1);
  });

  it('cliente al día', () => {
    fixture = TestBed.createComponent(FacturasPendientesComponent);
    fixture.componentInstance.facturas = [facturas[3]] as any;
    fixture.componentInstance.rol = 'adminInvoices';
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estás al día');
  });

  it('administrador: solo los pagos reportados, con el nombre del cliente como texto', () => {
    montar('adminFactonet');
    const tarjetas = el.querySelectorAll('.fp-card');
    expect(tarjetas.length).toBe(1);
    expect(el.querySelector('.fp-contador')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.fp-cliente')?.textContent).toBe('Cliente <b>B</b>');
    let revisada: any = null;
    fixture.componentInstance.revisar.subscribe((f: any) => (revisada = f));
    (el.querySelector('.fp-btn') as HTMLButtonElement).click();
    expect(revisada?.id).toBe(3);
  });

  it('otro rol no ve nada', () => {
    montar('userInout');
    expect(el.querySelector('.fp')).toBeNull();
  });
});
