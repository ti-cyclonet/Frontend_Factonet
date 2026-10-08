import { diasParaVencer, hoyLocal, pagosPorVerificar, resumenCliente, textoVencimiento } from './facturas-resumen';

const f = (id: number, estado: string, fechaVencimiento: string, total = 100, fechaPago?: string) =>
  ({ id, estado, fechaVencimiento, total, fechaPago });
const total = (x: { total: number }) => x.total;

describe('facturas-resumen', () => {
  it('hoyLocal usa la fecha local, no la UTC', () => {
    expect(hoyLocal(new Date(2026, 9, 8, 22, 30))).toBe('2026-10-08');
  });

  it('diasParaVencer cuenta días de calendario, negativo si ya venció', () => {
    expect(diasParaVencer('2026-10-11', '2026-10-08')).toBe(3);
    expect(diasParaVencer('2026-10-08', '2026-10-08')).toBe(0);
    expect(diasParaVencer('2026-10-01', '2026-10-08')).toBe(-7);
    expect(diasParaVencer('', '2026-10-08')).toBeNull();
  });

  it('textoVencimiento', () => {
    expect(textoVencimiento(0)).toBe('Vence hoy');
    expect(textoVencimiento(1)).toBe('Vence mañana');
    expect(textoVencimiento(5)).toBe('Vence en 5 días');
    expect(textoVencimiento(-1)).toBe('Vencida hace 1 día');
    expect(textoVencimiento(-4)).toBe('Vencida hace 4 días');
  });

  it('resumenCliente suma solo lo pendiente de pago y ordena por vencimiento', () => {
    const r = resumenCliente([
      f(1, 'Paid', '2026-09-01', 999),
      f(2, 'Issued', '2026-10-20', 150),
      f(3, 'In arrears', '2026-10-01', 200),
      f(4, 'Payment Reported', '2026-10-05', 300),
      f(5, 'Unconfirmed', '2026-10-30', 400),
      f(6, 'Suspended', '2026-09-15', 50),
    ], total, '2026-10-08');

    expect(r.porPagar.map(x => x.id)).toEqual([6, 3, 2]);
    expect(r.totalPendiente).toBe(400);
    expect(r.vencidas).toBe(2);
    expect(r.proximoVencimiento).toBe('2026-09-15');
    expect(r.enVerificacion.map(x => x.id)).toEqual([4]);
  });

  it('resumenCliente sin deudas', () => {
    const r = resumenCliente([f(1, 'Paid', '2026-09-01')], total, '2026-10-08');
    expect(r.porPagar).toEqual([]);
    expect(r.totalPendiente).toBe(0);
    expect(r.proximoVencimiento).toBeNull();
  });

  it('pagosPorVerificar: solo pagos reportados, el que lleva más tiempo esperando primero', () => {
    const r = pagosPorVerificar([
      f(1, 'Payment Reported', '2026-10-20', 1, '2026-10-07'),
      f(2, 'Issued', '2026-10-20'),
      f(3, 'Payment Reported', '2026-10-20', 1, '2026-10-02'),
    ]);
    expect(r.map(x => x.id)).toEqual([3, 1]);
  });
});
