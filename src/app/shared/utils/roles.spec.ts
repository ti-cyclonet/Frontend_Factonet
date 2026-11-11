import { isAccountingRole, isClientRole } from './roles';

describe('Roles de FactoNet', () => {
  it('la empresa con FactoNet es cliente de CycloNet y tiene contabilidad; el contador solo contabilidad', () => {
    expect(['adminInvoices', 'empresaFactonet', 'contadorFactonet', 'adminFactonet'].map(isClientRole)).toEqual([true, true, false, false]);
    expect(['adminInvoices', 'empresaFactonet', 'contadorFactonet', 'adminFactonet'].map(isAccountingRole)).toEqual([false, true, true, true]);
    expect(isClientRole(null)).toBeFalse();
  });
});
