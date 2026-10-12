import { permissoesDoSistema } from '../src/config/rbac';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../seeders/202612101215-seed-permissoes.js');

describe('seed de permissões', () => {
  it('é idêntico a permissoesDoSistema (src/config/rbac.ts)', () => {
    expect([...seed.nomesDasPermissoes].sort()).toEqual([...permissoesDoSistema].sort());
  });
});
