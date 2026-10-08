/**
 * Lógica de la vista de facturas por rol: qué debe el cliente y qué pagos
 * tiene que verificar el administrador. Funciones puras, sin Angular, para
 * probarlas sin montar el componente.
 */

/** Estados en los que la factura está emitida y nadie ha reportado su pago. */
export const ESTADOS_POR_PAGAR = ['Issued', 'In arrears', 'Notification1', 'Notification2', 'Suspended'];

/** El cliente reportó el pago y espera que el administrador lo verifique. */
export const ESTADO_POR_VERIFICAR = 'Payment Reported';

export interface FacturaResumible {
  id: number;
  estado: string;
  fechaVencimiento: string;
}

export interface ResumenCliente<T> {
  /** Facturas por pagar, de la que vence primero a la última. */
  porPagar: T[];
  /** Facturas con pago reportado, esperando verificación. */
  enVerificacion: T[];
  totalPendiente: number;
  vencidas: number;
  proximoVencimiento: string | null;
}

/** Fecha local 'YYYY-MM-DD' (no toISOString, que la pasa a UTC y en la noche de Colombia ya es mañana). */
export function hoyLocal(ahora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Días que faltan para el vencimiento; negativo si ya venció. Compara fechas, no horas. */
export function diasParaVencer(fechaVencimiento: string, hoy: string = hoyLocal()): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaVencimiento || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoy);
  if (!a || !b) return null;
  const dia = (m: RegExpExecArray) => Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000;
  return Math.round(dia(a) - dia(b));
}

/** Texto corto para la tarjeta: "Vence hoy", "Vence en 3 días", "Vencida hace 5 días". */
export function textoVencimiento(dias: number | null): string {
  if (dias === null) return 'Sin fecha de vencimiento';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  if (dias > 1) return `Vence en ${dias} días`;
  return dias === -1 ? 'Vencida hace 1 día' : `Vencida hace ${-dias} días`;
}

function porVencimiento<T extends FacturaResumible>(a: T, b: T): number {
  return (a.fechaVencimiento || '9999').localeCompare(b.fechaVencimiento || '9999');
}

/**
 * Lo que el cliente necesita ver primero: cuánto debe, cuándo vence lo
 * próximo y qué está vencido. `total` calcula el TOTAL de cada factura (el
 * mismo de la tabla y del PDF).
 */
export function resumenCliente<T extends FacturaResumible>(
  facturas: T[], total: (f: T) => number, hoy: string = hoyLocal(),
): ResumenCliente<T> {
  const porPagar = facturas.filter(f => ESTADOS_POR_PAGAR.includes(f.estado)).sort(porVencimiento);
  const enVerificacion = facturas.filter(f => f.estado === ESTADO_POR_VERIFICAR).sort(porVencimiento);
  return {
    porPagar,
    enVerificacion,
    totalPendiente: porPagar.reduce((s, f) => s + (Number(total(f)) || 0), 0),
    vencidas: porPagar.filter(f => (diasParaVencer(f.fechaVencimiento, hoy) ?? 0) < 0).length,
    proximoVencimiento: porPagar.find(f => f.fechaVencimiento)?.fechaVencimiento ?? null,
  };
}

/** Bandeja del administrador: pagos reportados, el más antiguo primero (lleva más tiempo esperando). */
export function pagosPorVerificar<T extends FacturaResumible & { fechaPago?: string | null }>(facturas: T[]): T[] {
  return facturas
    .filter(f => f.estado === ESTADO_POR_VERIFICAR)
    .sort((a, b) => (a.fechaPago || a.fechaVencimiento || '').localeCompare(b.fechaPago || b.fechaVencimiento || ''));
}
