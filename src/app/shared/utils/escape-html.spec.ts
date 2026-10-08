import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('neutraliza etiquetas y comillas', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('deja intacto el texto normal y convierte null/undefined en vacío', () => {
    expect(escapeHtml('Panadería La Espiga S.A.S.')).toBe('Panadería La Espiga S.A.S.');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
