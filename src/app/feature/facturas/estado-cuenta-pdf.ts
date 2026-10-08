import jsPDF from 'jspdf';
import { esLabel } from '../../shared/pipes/es-label.pipe';
import { diasParaVencer, hoyLocal, resumenCliente, textoVencimiento } from './facturas-resumen';

/** Datos para pagar por transferencia: los mismos del PDF de la factura. */
export const DATOS_PAGO_CYCLONET = [
  'Banco: Bancolombia  |  Cuenta de ahorros No. 039-000000-00  |  A nombre de: Cyclonet S. A. S.  |  NIT: 901.515.884-4',
  'Nequi / Daviplata: 314 414 4986',
];

export interface FacturaEstadoCuenta {
  id: number;
  numero: string;
  estado: string;
  fechaEmision?: string;
  fechaVencimiento: string;
  fechaPago?: string | null;
  periodoInicio?: string;
  periodoFin?: string;
  cliente?: string;
  clienteNit?: string;
  clienteTipoPersona?: string;
  clienteEmail?: string;
  clienteEmailContacto?: string;
  [k: string]: any;
}

const AZUL: [number, number, number] = [60, 60, 150];
const ROJO: [number, number, number] = [190, 18, 60];
const GRIS: [number, number, number] = [100, 116, 139];

const dinero = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

function fecha(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '—';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** dd/mm/aaaa: el periodo lleva dos fechas y en formato largo no cabe en su columna. */
function fechaCorta(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

function periodo(f: FacturaEstadoCuenta): string {
  return f.periodoInicio && f.periodoFin ? `${fechaCorta(f.periodoInicio)} a ${fechaCorta(f.periodoFin)}` : '—';
}

interface Columna { titulo: string; ancho: number; derecha?: boolean }

/**
 * Estado de cuenta del cliente: cuánto debe, qué está vencido, qué está en
 * verificación y sus últimos pagos, con los datos para pagar.
 * `total` es el TOTAL de cada factura (el mismo de la tabla y del PDF de la factura).
 */
export function generarEstadoCuenta(
  facturas: FacturaEstadoCuenta[],
  total: (f: any) => number,
  opciones: { hoy?: string; logo?: HTMLImageElement | null } = {},
): jsPDF {
  const hoy = opciones.hoy || hoyLocal();
  const r = resumenCliente(facturas, total, hoy);
  const pagadas = facturas
    .filter(f => f.estado === 'Paid')
    .sort((a, b) => (b.fechaPago || b.fechaEmision || '').localeCompare(a.fechaPago || a.fechaEmision || ''))
    .slice(0, 12);
  const cliente = facturas.find(f => f.cliente) || ({} as FacturaEstadoCuenta);

  const pdf = new jsPDF();
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 15;
  let y = 15;

  const nuevaPaginaSiHaceFalta = (alto: number) => {
    if (y + alto > H - 22) {
      pdf.addPage();
      y = 18;
    }
  };

  // ── Encabezado ──
  if (opciones.logo) {
    const ancho = 45;
    pdf.addImage(opciones.logo, 'PNG', M, 10, ancho, (opciones.logo.height * ancho) / opciones.logo.width);
  }
  pdf.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...AZUL);
  pdf.text('ESTADO DE CUENTA', W - M, 18, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS);
  pdf.text(`Fecha de corte: ${fecha(hoy)}`, W - M, 24, { align: 'right' });
  pdf.text('Cyclonet S. A. S.  ·  NIT 901.515.884-4', W - M, 29, { align: 'right' });
  y = 40;

  // ── Cliente ──
  pdf.setFillColor(240, 240, 250).setDrawColor(200, 200, 200);
  pdf.rect(M, y, W - 2 * M, 18, 'FD');
  pdf.setTextColor(0, 0, 0).setFont('helvetica', 'bold').setFontSize(10);
  pdf.text(cliente.cliente || 'Cliente', M + 4, y + 7);
  pdf.setFont('helvetica', 'normal').setFontSize(8.5);
  const doc = cliente.clienteNit ? `${cliente.clienteTipoPersona === 'J' ? 'NIT' : 'CC'}: ${cliente.clienteNit}` : '';
  pdf.text([doc, cliente.clienteEmailContacto || cliente.clienteEmail || ''].filter(Boolean).join('   ·   '), M + 4, y + 13);
  y += 26;

  // ── Resumen ──
  const cajas: Array<[string, string, [number, number, number]]> = [
    ['Total por pagar', dinero(r.totalPendiente), AZUL],
    ['Facturas vencidas', String(r.vencidas), r.vencidas ? ROJO : AZUL],
    ['Próximo vencimiento', r.proximoVencimiento ? fecha(r.proximoVencimiento) : 'Al día', AZUL],
  ];
  const anchoCaja = (W - 2 * M - 8) / 3;
  cajas.forEach(([titulo, valor, color], i) => {
    const x = M + i * (anchoCaja + 4);
    pdf.setDrawColor(...color).setLineWidth(0.6);
    pdf.rect(x, y, anchoCaja, 18);
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS);
    pdf.text(titulo.toUpperCase(), x + 4, y + 6);
    pdf.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...color);
    pdf.text(valor, x + 4, y + 14);
  });
  pdf.setLineWidth(0.2);
  y += 28;

  // ── Tablas ──
  const tabla = (titulo: string, columnas: Columna[], filas: Array<{ celdas: string[]; resaltar?: boolean }>, vacio: string) => {
    nuevaPaginaSiHaceFalta(24);
    pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...AZUL);
    pdf.text(titulo, M, y);
    y += 3;
    const encabezado = () => {
      pdf.setFillColor(...AZUL);
      pdf.rect(M, y, W - 2 * M, 7, 'F');
      pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
      let x = M;
      for (const c of columnas) {
        pdf.text(c.titulo, c.derecha ? x + c.ancho - 2 : x + 2, y + 5, c.derecha ? { align: 'right' } : undefined);
        x += c.ancho;
      }
      y += 7;
    };
    encabezado();
    pdf.setFont('helvetica', 'normal').setFontSize(8);
    if (!filas.length) {
      pdf.setTextColor(...GRIS);
      pdf.text(vacio, M + 2, y + 5);
      y += 9;
    }
    filas.forEach((fila, i) => {
      if (y + 7 > H - 22) {
        pdf.addPage();
        y = 18;
        encabezado();
        pdf.setFont('helvetica', 'normal').setFontSize(8);
      }
      if (i % 2) {
        pdf.setFillColor(247, 248, 252);
        pdf.rect(M, y, W - 2 * M, 7, 'F');
      }
      pdf.setTextColor(...(fila.resaltar ? ROJO : ([30, 41, 59] as [number, number, number])));
      let x = M;
      fila.celdas.forEach((t, j) => {
        const c = columnas[j];
        pdf.text(t, c.derecha ? x + c.ancho - 2 : x + 2, y + 5, c.derecha ? { align: 'right' } : undefined);
        x += c.ancho;
      });
      y += 7;
    });
    y += 8;
  };

  const anchoUtil = W - 2 * M;
  tabla('Facturas por pagar', [
    { titulo: 'Factura', ancho: 25 },
    { titulo: 'Periodo de servicio', ancho: 52 },
    { titulo: 'Vence', ancho: 25 },
    { titulo: 'Situación', ancho: anchoUtil - 25 - 52 - 25 - 32 },
    { titulo: 'Total', ancho: 32, derecha: true },
  ], r.porPagar.map(f => {
    const dias = diasParaVencer(f.fechaVencimiento, hoy);
    return {
      celdas: [f.numero, periodo(f), fecha(f.fechaVencimiento), `${esLabel(f.estado)} · ${textoVencimiento(dias)}`, dinero(total(f))],
      resaltar: dias !== null && dias < 0,
    };
  }), 'No tienes facturas pendientes de pago.');

  if (r.enVerificacion.length) {
    tabla('Pagos reportados en verificación', [
      { titulo: 'Factura', ancho: 25 },
      { titulo: 'Periodo de servicio', ancho: 52 },
      { titulo: 'Pago reportado', ancho: anchoUtil - 25 - 52 - 32 },
      { titulo: 'Total', ancho: 32, derecha: true },
    ], r.enVerificacion.map(f => ({ celdas: [f.numero, periodo(f), fecha(f.fechaPago), dinero(total(f))] })), '');
  }

  tabla('Últimos pagos', [
    { titulo: 'Factura', ancho: 25 },
    { titulo: 'Periodo de servicio', ancho: 52 },
    { titulo: 'Fecha de pago', ancho: anchoUtil - 25 - 52 - 32 },
    { titulo: 'Total', ancho: 32, derecha: true },
  ], pagadas.map(f => ({ celdas: [f.numero, periodo(f), fecha(f.fechaPago), dinero(total(f))] })), 'Aún no hay pagos registrados.');

  // ── Cómo pagar ──
  nuevaPaginaSiHaceFalta(22);
  pdf.setFillColor(240, 240, 250).setDrawColor(200, 200, 200);
  pdf.rect(M, y, W - 2 * M, 18, 'FD');
  pdf.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
  pdf.text('CÓMO PAGAR', M + 3, y + 6);
  pdf.setFont('helvetica', 'normal').setFontSize(7.5);
  pdf.text(DATOS_PAGO_CYCLONET, M + 3, y + 11);

  // ── Pie en cada página ──
  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...AZUL).setLineWidth(0.3);
    pdf.line(M, H - 15, W - M, H - 15);
    pdf.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS);
    pdf.text(`Estado de cuenta al ${fecha(hoy)}. Los pagos en verificación se aplican al ser confirmados.`, M, H - 10);
    pdf.text(`Página ${p} de ${paginas}`, W - M, H - 10, { align: 'right' });
  }
  return pdf;
}

/** Nombre del archivo: Estado_de_cuenta_<cliente>_<fecha>.pdf, sin caracteres raros. */
export function nombreArchivoEstadoCuenta(cliente: string | undefined, hoy: string = hoyLocal()): string {
  const limpio = (cliente || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `Estado_de_cuenta_${limpio || 'cliente'}_${hoy}.pdf`;
}

