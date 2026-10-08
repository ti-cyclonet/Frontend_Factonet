import { fechaLocal } from './fechas';

describe('fechaLocal', () => {
  it('una fecha sin hora es ese día local, no el anterior', () => {
    const d = fechaLocal('2026-10-10')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 10]);
  });

  it('una fecha con hora se respeta', () => {
    expect(fechaLocal('2026-10-10T15:00:00Z')!.toISOString()).toBe('2026-10-10T15:00:00.000Z');
  });

  it('vacía o inválida: null', () => {
    expect(fechaLocal('')).toBeNull();
    expect(fechaLocal(null)).toBeNull();
    expect(fechaLocal('ayer')).toBeNull();
  });
});
