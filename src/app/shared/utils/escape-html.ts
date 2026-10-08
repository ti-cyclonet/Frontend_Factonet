/**
 * Escapa texto para insertarlo en el `html` de SweetAlert. Los nombres de
 * cliente, números y motivos de rechazo vienen de datos que escriben los
 * usuarios: sin escapar, un nombre con <img onerror=...> se ejecutaría en el
 * navegador del administrador al abrir la constancia.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
