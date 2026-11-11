/**
 * Roles de FactoNet:
 * - adminFactonet: personal de CycloNet (todo, y la contabilidad de CycloNet).
 * - adminInvoices: cliente de CycloNet (sus facturas y contratos).
 * - empresaFactonet: empresa que contrata FactoNet (su contabilidad) y, como
 *   cliente de CycloNet, sus facturas y contratos.
 * - contadorFactonet: contador invitado por la empresa (solo su contabilidad).
 */
export const CLIENT_ROLES = ['adminInvoices', 'empresaFactonet'];
export const ACCOUNTING_ROLES = ['adminFactonet', 'empresaFactonet', 'contadorFactonet'];

/** Frente a CycloNet es cliente: ve y paga sus propias facturas. */
export const isClientRole = (rol: string | null | undefined) => CLIENT_ROLES.includes(String(rol || ''));
export const isAccountingRole = (rol: string | null | undefined) => ACCOUNTING_ROLES.includes(String(rol || ''));
