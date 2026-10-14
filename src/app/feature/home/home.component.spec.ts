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

  it('administrador: pagos por verificar primero; las tareas de contratos van en su vista', () => {
    component.userRol = 'adminFactonet';
    (component as any).buildDerived(overview());
    const labels = component.attention.map(a => a.label);
    expect(labels[0]).toBe('Pagos reportados por verificar');
    expect(labels).toContain('Facturas por confirmar');
    expect(labels).not.toContain('Contratos por tu firma');
    expect(component.contractAttention.map(a => a.label)).toEqual(['Contratos por tu firma']);
  });

  it('administrador: contratos por vencer y suspendidos en la vista de contratos', () => {
    component.userRol = 'adminFactonet';
    const contracts = { kpis: { expiringCount: 2, expiringMrr: 300000, suspended: 1 }, statusCount: { ACTIVE: 3, SUSPENDED: 1 }, byPackage: [], byMode: { MONTHLY: 3 }, months: [], expiring: [], recent: [], ids: [] };
    (component as any).buildDerived({ ...overview(), contracts });
    expect(component.contractAttention.map(a => a.label)).toEqual(['Contratos por tu firma', 'Vencen en 30 días', 'Contratos suspendidos']);
    expect(component.contractBars.map(b => [b.label, b.count])).toEqual([['Activo', 3], ['Suspendido', 1]]);
  });

  describe('burbujas de novedades', () => {
    const conFacturas = (ids: number[], extra: any = {}) => ({
      ...overview(), invoiceIds: ids,
      recentInvoices: ids.map((id) => ({ id, numero: `DF${id}`, cliente: 'Café Aroma', total: 105910, estado: 'Issued', vence: '' })), ...extra,
    });
    beforeEach(() => { component.soundOn = false; });

    it('la primera carga no avisa; una factura nueva sí', () => {
      component.userRol = 'adminFactonet';
      (component as any).detectNews(conFacturas([1, 2]));
      expect(component.bubbles).toEqual([]);
      (component as any).detectNews(conFacturas([1, 2, 3]));
      expect(component.bubbles.length).toBe(1);
      expect(component.bubbles[0].title).toBe('Nueva factura');
      expect(component.bubbles[0].detail).toContain('DF3 · Café Aroma');
    });

    it('un contrato nuevo avisa con su código y cliente', () => {
      component.userRol = 'adminFactonet';
      const contracts = (ids: string[]) => ({ ids, recent: ids.map((id) => ({ id, code: `CT-${id}`, cliente: 'Hotel Bahía', paquete: 'PRO' })) });
      (component as any).detectNews(conFacturas([1], { contracts: contracts(['a']) }));
      (component as any).detectNews(conFacturas([1], { contracts: contracts(['a', 'b']) }));
      expect(component.bubbles.map(b => [b.kind, b.detail])).toEqual([['contract', 'CT-b · Hotel Bahía · PRO']]);
    });

    it('muchas novedades juntas se agrupan en una burbuja', () => {
      component.userRol = 'adminInvoices';
      (component as any).detectNews(conFacturas([1]));
      (component as any).detectNews(conFacturas([1, 2, 3, 4, 5]));
      expect(component.bubbles.map(b => b.title)).toEqual(['4 facturas nuevas']);
    });
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
