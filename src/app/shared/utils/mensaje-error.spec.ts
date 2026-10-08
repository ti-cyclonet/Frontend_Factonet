import { mensajeError } from './mensaje-error';

describe('mensajeError', () => {
  it('usa el mensaje del backend', () => {
    expect(mensajeError({ error: { message: 'Esta factura no pertenece a tu cuenta.' } }, 'x')).toBe('Esta factura no pertenece a tu cuenta.');
  });
  it('une los errores de validación', () => {
    expect(mensajeError({ error: { message: ['La fecha de pago no es válida.', 'El valor pagado debe ser mayor que cero.'] } }, 'x'))
      .toBe('La fecha de pago no es válida. El valor pagado debe ser mayor que cero.');
  });
  it('sin mensaje usa el de respaldo', () => {
    expect(mensajeError({ status: 0, error: new ProgressEvent('error') }, 'Sin conexión')).toBe('Sin conexión');
    expect(mensajeError(null, 'Sin conexión')).toBe('Sin conexión');
  });
});
