import { cpfValido } from '../src/utils/cpf';

describe('cpfValido', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('aceita %s', (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  it.each(['111.111.111-11', '529.982.247-24', '123', '', 'abc', '000.000.000-00'])('recusa "%s"', (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });
});
