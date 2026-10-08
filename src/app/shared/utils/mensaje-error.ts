/**
 * Texto para mostrarle al usuario a partir de un HttpErrorResponse del backend.
 * NestJS manda `message` como texto o, en errores de validación, como lista.
 */
export function mensajeError(error: any, respaldo: string): string {
  const m = error?.error?.message;
  if (Array.isArray(m)) return m.filter(Boolean).join(' ') || respaldo;
  return typeof m === 'string' && m.trim() ? m : respaldo;
}
