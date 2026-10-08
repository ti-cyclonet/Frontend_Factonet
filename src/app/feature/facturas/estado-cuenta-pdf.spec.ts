import { generarEstadoCuenta, nombreArchivoEstadoCuenta } from './estado-cuenta-pdf';

const base = { cliente: 'Panadería La Espiga S.A.S.', clienteNit: '901000000', clienteTipoPersona: 'J', periodoInicio: '2026-08-04', periodoFin: '2026-09-02' };
const facturas = [
  { ...base, id: 1, numero: 'DF00101', estado: 'In arrears', fechaVencimiento: '2026-10-02', total: 105910 },
  { ...base, id: 2, numero: 'DF00102', estado: 'Issued', fechaVencimiento: '2026-10-10', total: 105910 },
  { ...base, id: 3, numero: 'DF00099', estado: 'Payment Reported', fechaVencimiento: '2026-09-08', fechaPago: '2026-10-07', total: 105910 },
  { ...base, id: 4, numero: 'DF00098', estado: 'Paid', fechaVencimiento: '2026-08-09', fechaPago: '2026-08-07', total: 105910 },
];
const total = (f: any) => f.total;

/** Texto del PDF: jsPDF lo escribe sin comprimir, cada cadena entre paréntesis. */
const textoDe = (pdf: any) => pdf.output() as string;

describe('generarEstadoCuenta', () => {
  it('incluye cliente, total por pagar, vencidas, en verificación y últimos pagos', () => {
    const t = textoDe(generarEstadoCuenta(facturas as any, total, { hoy: '2026-10-08' }));
    expect(t).toContain('ESTADO DE CUENTA');
    expect(t).toContain('NIT: 901000000');
    expect(t).toContain('$211.820');            // DF00101 + DF00102
    expect(t).toContain('DF00101');
    expect(t).toContain('Vencida hace 6 d');     // acentos codificados aparte
    expect(t).toContain('Vence en 2 d');
    expect(t).toContain('DF00099');              // en verificación
    expect(t).toContain('DF00098');              // último pago
    expect(t).toContain('Bancolombia');
  });

  it('cliente al día: lo dice y no lista pendientes', () => {
    const t = textoDe(generarEstadoCuenta([facturas[3]] as any, total, { hoy: '2026-10-08' }));
    expect(t).toContain('Al d');
    expect(t).toContain('No tienes facturas pendientes de pago.');
    expect(t).not.toContain('DF00101');
  });

  it('muchas facturas: pasa a otra página y numera las páginas', () => {
    const muchas = Array.from({ length: 45 }, (_, i) => ({ ...base, id: 100 + i, numero: `DF${200 + i}`, estado: 'Issued', fechaVencimiento: '2026-11-01', total: 1000 }));
    const pdf = generarEstadoCuenta(muchas as any, total, { hoy: '2026-10-08' });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(textoDe(pdf)).toContain(`gina 2 de ${pdf.getNumberOfPages()}`);
  });
});

describe('nombreArchivoEstadoCuenta', () => {
  it('sin tildes ni símbolos', () => {
    expect(nombreArchivoEstadoCuenta('Panadería La Espiga S.A.S.', '2026-10-08')).toBe('Estado_de_cuenta_Panaderia_La_Espiga_S_A_S_2026-10-08.pdf');
    expect(nombreArchivoEstadoCuenta(undefined, '2026-10-08')).toBe('Estado_de_cuenta_cliente_2026-10-08.pdf');
  });
});
