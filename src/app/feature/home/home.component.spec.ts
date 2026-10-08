import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

const overview = (o: any = {}) => ({
  generatedAt: '', scope: 'client',
  kpis: {
    billedMonth: 0, billedPrevMonth: 0, collectedMonth: 0, collectedPrevMonth: 0, openValue: 0, openCount: 0,
    overdueValue: 211820, overdueCount: 2, dueSoonValue: 105910, dueSoonCount: 1, reportedCount: 1, reportedValue: 105910,
    unconfirmedCount: 3, paidYear: 0, collectionRate: null, totalInvoices: 0, activeContracts: 0, totalContracts: 0, mrr: 0,
    ...o,
  },
  contractsPending: { adminSignature: [{ id: 'c1' }], clientSignature: [], needsPdf: [], needsIssue: [] },
  statusCount: { Paid: 2, Issued: 1 }, months: [], overdueInvoices: [], dueSoonInvoices: [], reportedInvoices: [], topDebtors: [], recentInvoices: [],
});

/** Sin detectChanges: ngOnInit (que consulta el API y arranca temporizadores) no corre. */
describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  it('cliente: avisa vencidas, por vencer y pagos en verificación, con montos', () => {
    component.userRol = 'adminInvoices';
    (component as any).buildDerived(overview());
    expect(component.attention.map(a => a.label)).toEqual(['Facturas vencidas', 'Vencen en 7 días', 'Pagos en verificación']);
    expect(component.attention[0].detail).toContain('$211.820');
  });

  it('administrador: pagos por verificar primero, y tareas de contratos', () => {
    component.userRol = 'adminFactonet';
    (component as any).buildDerived(overview());
    const labels = component.attention.map(a => a.label);
    expect(labels[0]).toBe('Pagos reportados por verificar');
    expect(labels).toContain('Facturas por confirmar');
    expect(labels).toContain('Contratos por tu firma');
  });

  it('sin pendientes no hay avisos', () => {
    component.userRol = 'adminInvoices';
    (component as any).buildDerived(overview({ overdueCount: 0, dueSoonCount: 0, reportedCount: 0 }));
    expect(component.attention).toEqual([]);
  });

  it('variación contra el mes anterior', () => {
    expect(component.delta(150, 100)).toBe(50);
    expect(component.delta(50, 100)).toBe(-50);
    expect(component.delta(0, 0)).toBe(0);
    expect(component.delta(10, 0)).toBeNull();
  });

  it('montos compactos', () => {
    expect(component.compactMoney(2_500_000)).toBe('$2,5 M');
    expect(component.compactMoney(105_910)).toBe('$106 mil');
    expect(component.compactMoney(9_000)).toBe('$9.000');
  });

  it('una fecha de vencimiento se muestra en su día (no el anterior)', () => {
    expect(component.shortDate('2026-10-10')).toContain('10');
    expect(component.longDate('2026-10-10')).toContain('2026');
    expect(component.shortDate('')).toBe('—');
  });
});
