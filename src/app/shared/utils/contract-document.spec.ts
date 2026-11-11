import { contractPdfBase64, getContractBodyText, numberToWords } from './contract-document';

const contrato: any = {
  id: 'c-1', code: 'CT-9', value: 1020000, mode: 'MONTHLY', payday: 5, startDate: '2026-11-10', endDate: '2027-11-10',
  package: { name: 'KIRI PLUS', description: 'Kiri PLUS', targetApplication: 'Kiri' },
  user: { strUserName: 'dueno@tienda.co', basicData: { documentNumber: '900123456', documentType: { description: 'NIT' }, legalEntityData: { businessName: 'Tienda Demo SAS', contactName: 'Ana' } } },
};

describe('contract-document (PDF del contrato compartido)', () => {
  it('arma el texto con el cliente, el valor mensual en letras y la exclusión de IVA', () => {
    const t = getContractBodyText(contrato);
    expect(t).toContain('Tienda Demo SAS');
    expect(t).toContain('$85.000');
    expect(t).toContain('numeral 21 del artículo 476');
    expect(numberToWords(85000).toLowerCase()).toContain('ochenta');
  });

  it('nombra la aplicación contratada y es acceso al servicio, no licencia ni arriendo', () => {
    const t = getContractBodyText(contrato);
    expect(t).toContain('Software Kiri');
    expect(t).not.toContain('InOut');
    expect(t).toContain('DERECHO DE ACCESO AL SERVICIO');
    expect(t).not.toContain('LICENCIA DE USO (ARRIENDO)');
    expect(getContractBodyText({ ...contrato, package: { ...contrato.package, targetApplication: null } })).toContain('Software CycloNet');
  });

  it('genera un PDF válido en base64', () => {
    const b64 = contractPdfBase64(contrato);
    expect(atob(b64).startsWith('%PDF')).toBeTrue();
  });
});
