import { Pipe, PipeTransform } from '@angular/core';

/**
 * Etiquetas en español para los valores que llegan del backend en inglés
 * (estados de facturas y contratos, modalidades, tipos, menú de Authoriza).
 * Solo cambia lo que se muestra: la lógica sigue comparando el valor original.
 * Uso: {{ factura.estado | es }}.
 */
export const ES_LABELS: Record<string, string> = {
  // Facturas
  Unconfirmed: 'Sin confirmar', Issued: 'Emitida', 'In arrears': 'En mora', Notification1: 'Primer aviso',
  Notification2: 'Segundo aviso', Suspended: 'Suspendida', 'Payment Reported': 'Pago reportado', Paid: 'Pagada',
  // Contratos
  DRAFT: 'Borrador', PENDING: 'Pendiente', ACTIVE: 'Activo', SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido', TERMINATED: 'Terminado', RENEWED: 'Renovado', DELETED: 'Eliminado', INACTIVE: 'Inactivo',
  // Modalidad de pago
  MONTHLY: 'Mensual', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual',
  // Parámetros
  NUMERIC: 'Numérico', TEXT: 'Texto', ADD: 'Suma', SUBTRACT: 'Resta', APPLIED: 'Aplicado',
  // Menú (descripciones que guarda Authoriza)
  Home: 'Inicio', Dashboard: 'Panel', Contracts: 'Contratos', Invoices: 'Facturas', Periods: 'Periodos',
  'Invoice Parameters': 'Parámetros de facturas', Reports: 'Reportes', Settings: 'Configuración',
  Administrator: 'Administrador', 'Invoice Administrator': 'Administrador de facturas',
  'Full access': 'Acceso total', 'Access only to invoices': 'Acceso solo a facturas',
};

export function esLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return ES_LABELS[value] ?? ES_LABELS[String(value).toUpperCase()] ?? String(value);
}

@Pipe({ name: 'es', standalone: true })
export class EsLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, upper = false): string {
    const l = esLabel(value);
    return upper ? l.toUpperCase() : l;
  }
}
