/**
 * Fecha para mostrar. Una fecha sin hora ('2026-10-10', columnas date) se
 * toma como día local: new Date('2026-10-10') es medianoche UTC, que en
 * Colombia es el 9 a las 7 p. m., y se mostraba un día antes.
 */
export function fechaLocal(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}
