import request from 'supertest';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { app } from '../src/app';
import { sequelize } from '../src/config/database';
import { redis } from '../src/config/redis';
import { Usuario, Cargo, Permissao, CargoPermissao, UsuarioCargo, Endereco } from '../src/models';

const api = request(app);
const run = Date.now().toString(36); 
const email = (tag: string) => `${tag}-${run}@mce.test`;
const cpfDeTeste = '529.982.247-25';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const decodificar = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

const cadastrar = (tag: string) =>
  api.post('/usuarios').send({ nome: `Teste ${tag}`, email: email(tag), senha: '123456', cpf: cpfDeTeste, telefone: '(44) 99999-8888' });
const logar = (tag: string, senha = '123456') => api.post('/auth/login').send({ email: email(tag), senha });

async function criarAdmin(tag: string) {
  const usuario = await Usuario.create({
    nome: 'Admin Teste',
    email: email(tag),
    senha: await bcrypt.hash('123456', 4),
    admin: true,
  });
  const cargo = await Cargo.findOne({ where: { nome: 'administrador' } });
  await usuario.addCargo(cargo!);
  return usuario;
}

let tokenAdmin = '';
let idAdmin = 0;
let tokenCliente = '';
let idCliente = 0;

beforeAll(async () => {
  const seedRodou = await Cargo.findOne({ where: { nome: 'administrador' } });
  if (!seedRodou) {
    throw new Error('Rode "npm run migrate && npm run seed" antes dos testes (faltam cargos/permissões).');
  }
  idAdmin = (await criarAdmin('admin')).id_usuario;
  tokenAdmin = (await logar('admin')).body.token;

  const cadastro = await cadastrar('cliente');
  idCliente = cadastro.body.id_usuario;
  tokenCliente = (await logar('cliente')).body.token;
});

afterAll(async () => {
  const usuarios = await Usuario.findAll({ where: { email: { [Op.like]: `%-${run}@mce.test` } } });
  const ids = usuarios.map((u) => u.id_usuario);
  await Endereco.destroy({ where: { id_usuario: ids } });
  await UsuarioCargo.destroy({ where: { id_usuario: ids } });
  await Usuario.destroy({ where: { id_usuario: ids } });

  const cargos = await Cargo.findAll({ where: { nome: { [Op.like]: `teste-${run}%` } } });
  await CargoPermissao.destroy({ where: { id_cargo: cargos.map((c) => c.id_cargo) } });
  await Cargo.destroy({ where: { id_cargo: cargos.map((c) => c.id_cargo) } });

  const permissoes = await Permissao.findAll({ where: { nome: { [Op.like]: `teste:${run}%` } } });
  await CargoPermissao.destroy({ where: { id_permissao: permissoes.map((p) => p.id_permissao) } });
  await Permissao.destroy({ where: { id_permissao: permissoes.map((p) => p.id_permissao) } });

  await sequelize.close();
  redis.disconnect();
});

describe('cadastro e validação (RF01)', () => {
  const base = { nome: 'Maria', email: email('maria'), senha: '123456', cpf: cpfDeTeste, telefone: '44999998888' };

  it('recusa cadastro sem CPF e telefone', async () => {
    const r = await api.post('/usuarios').send({ nome: 'Maria', email: email('maria'), senha: '123456' });
    expect(r.status).toBe(400);
  });

  it.each(['111.111.111-11', '529.982.247-24'])('recusa CPF inválido %s', async (cpf) => {
    expect((await api.post('/usuarios').send({ ...base, cpf })).status).toBe(400);
  });

  it('cadastra, normaliza os dados e não devolve a senha', async () => {
    const r = await api.post('/usuarios').send({ ...base, email: `  ${email('maria').toUpperCase()} `, telefone: '(44) 99999-8888' });
    expect(r.status).toBe(201);
    expect(r.body.email).toBe(email('maria'));
    expect(r.body.cpf).toBe('52998224725');
    expect(r.body.telefone).toBe('44999998888');
    expect(r.body.cargos).toEqual(['cliente']);
    expect(r.body).not.toHaveProperty('senha');
  });

  it('recusa e-mail duplicado (mesmo com caixa diferente)', async () => {
    expect((await api.post('/usuarios').send({ ...base, email: email('maria').toUpperCase() })).status).toBe(409);
  });

  it('JSON malformado vira 400 (não 500)', async () => {
    const r = await api.post('/usuarios').set('Content-Type', 'application/json').send('{"nome":"x"');
    expect(r.status).toBe(400);
  });
});

describe('login e sessão (RF02, RF03)', () => {
  it('recusa senha errada e usuário inexistente com a mesma resposta', async () => {
    const errada = await logar('cliente', 'errada');
    const inexistente = await api.post('/auth/login').send({ email: email('ninguem'), senha: '123456' });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body); // não revela se o e-mail existe
  });

  it('login devolve access token (com cargos/permissões), refresh token e expiração', async () => {
    const r = await logar('admin');
    expect(r.status).toBe(200);
    expect(r.body.tipo).toBe('Bearer');
    expect(r.body.expiraEm).toBe(3600);
    expect(typeof r.body.refreshToken).toBe('string');
    const payload = decodificar(r.body.token);
    expect(payload.cargos).toContain('administrador');
    expect(payload.permissoes).toHaveLength(12);
    expect(r.body.usuario).not.toHaveProperty('senha');
  });

  it('refresh renova a sessão e faz rotação (token antigo morre)', async () => {
    const { refreshToken } = (await logar('cliente')).body;
    const novo = await api.post('/auth/refresh').send({ refreshToken });
    expect(novo.status).toBe(200);
    expect(novo.body.refreshToken).not.toBe(refreshToken);
    expect((await api.post('/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api.post('/auth/refresh').send({ refreshToken: novo.body.refreshToken })).status).toBe(200);
  });

  it('recusa refresh token inventado ou malformado', async () => {
    expect((await api.post('/auth/refresh').send({ refreshToken: 'x'.repeat(40) })).status).toBe(401);
    expect((await api.post('/auth/refresh').send({ refreshToken: 'curto' })).status).toBe(400);
  });

  it('no Redis fica só o hash do refresh token, nunca o valor em claro', async () => {
    const { refreshToken } = (await logar('cliente')).body;
    const chaves = await redis.keys('*');
    expect(chaves.length).toBeGreaterThan(0);
    expect(chaves.some((k: string) => k.includes(refreshToken))).toBe(false);
  });

  it('logout invalida o refresh token e é idempotente', async () => {
    const { refreshToken } = (await logar('cliente')).body;
    expect((await api.post('/auth/logout').send({ refreshToken })).status).toBe(204);
    expect((await api.post('/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api.post('/auth/logout').send({ refreshToken })).status).toBe(204);
  });

  it('logout-todos encerra todas as sessões do usuário', async () => {
    const a = (await logar('cliente')).body;
    const b = (await logar('cliente')).body;
    expect((await api.post('/auth/logout-todos')).status).toBe(401);
    expect((await api.post('/auth/logout-todos').set(auth(a.token))).status).toBe(204);
    expect((await api.post('/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);
    expect((await api.post('/auth/refresh').send({ refreshToken: b.refreshToken })).status).toBe(401);
  });

  it('rotas protegidas exigem token válido', async () => {
    expect((await api.get('/usuarios/me')).status).toBe(401);
    expect((await api.get('/usuarios/me').set(auth('token.invalido.aqui'))).status).toBe(401);
  });
});

describe('perfil e senha (RF04)', () => {
  it('/me devolve o próprio usuário com cargos e permissões', async () => {
    const r = await api.get('/usuarios/me').set(auth(tokenCliente));
    expect(r.status).toBe(200);
    expect(r.body.id_usuario).toBe(idCliente);
    expect(r.body.cargos).toEqual(['cliente']);
    expect(r.body.permissoes).toEqual([]);
  });

  it('edita nome/telefone, mas não o e-mail', async () => {
    const ok = await api.patch('/usuarios/me').set(auth(tokenCliente)).send({ nome: 'Cliente Editado' });
    expect(ok.status).toBe(200);
    expect(ok.body.nome).toBe('Cliente Editado');
    expect((await api.patch('/usuarios/me').set(auth(tokenCliente)).send({ email: 'novo@mce.com' })).status).toBe(400);
    expect((await api.patch('/usuarios/me').set(auth(tokenCliente)).send({})).status).toBe(400);
  });

  it('troca de senha valida a atual, recusa repetir e derruba as sessões abertas', async () => {
    await cadastrar('senha');
    const { token, refreshToken } = (await logar('senha')).body;
    const rota = '/usuarios/me/senha';
    expect((await api.patch(rota).set(auth(token)).send({ senhaAtual: 'errada', novaSenha: 'abcdef' })).status).toBe(401);
    expect((await api.patch(rota).set(auth(token)).send({ senhaAtual: '123456', novaSenha: '123456' })).status).toBe(400);
    expect((await api.patch(rota).set(auth(token)).send({ senhaAtual: '123456', novaSenha: 'abcdef' })).status).toBe(204);
    expect((await api.post('/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await logar('senha', '123456')).status).toBe(401);
    expect((await logar('senha', 'abcdef')).status).toBe(200);
  });
});

describe('autorização por permissão (RF06, RF07, RF08, RF09)', () => {
  it('cliente não lista usuários nem lê dados de outro usuário', async () => {
    expect((await api.get('/usuarios').set(auth(tokenCliente))).status).toBe(403);
    expect((await api.get(`/usuarios/${idAdmin}`).set(auth(tokenCliente))).status).toBe(403);
  });

  it('cliente lê os próprios dados; admin lê qualquer usuário', async () => {
    expect((await api.get(`/usuarios/${idCliente}`).set(auth(tokenCliente))).status).toBe(200);
    expect((await api.get(`/usuarios/${idCliente}`).set(auth(tokenAdmin))).status).toBe(200);
  });

  it('valida o parâmetro :id (antes virava NaN)', async () => {
    expect((await api.get('/usuarios/abc').set(auth(tokenAdmin))).status).toBe(400);
    expect((await api.get('/usuarios/99999999').set(auth(tokenAdmin))).status).toBe(404);
  });

  it('listagem paginada, com busca e filtros, sem expor senha', async () => {
    const r = await api.get('/usuarios?page=1&limit=2').set(auth(tokenAdmin));
    expect(r.status).toBe(200);
    expect(r.body.dados.length).toBeLessThanOrEqual(2);
    expect(r.body.paginacao.pagina).toBe(1);
    expect(r.body.paginacao.total).toBeGreaterThanOrEqual(2);
    expect(r.body.dados[0]).not.toHaveProperty('senha');

    const busca = await api.get(`/usuarios?busca=cliente-${run}`).set(auth(tokenAdmin));
    expect(busca.body.paginacao.total).toBe(1);

    const porCargo = await api.get(`/usuarios?cargo=administrador&busca=-${run}`).set(auth(tokenAdmin));
    expect(porCargo.body.paginacao.total).toBe(1);

    expect((await api.get('/usuarios?limit=500').set(auth(tokenAdmin))).status).toBe(400);
    expect((await api.get('/usuarios?ativo=talvez').set(auth(tokenAdmin))).status).toBe(400);
  });

  it('atribuir cargo reflete no próximo login e libera as permissões do cargo', async () => {
    expect((await api.put(`/usuarios/${idCliente}/cargos`).set(auth(tokenCliente)).send({ cargos: ['administrador'] })).status).toBe(403);
    expect((await api.put(`/usuarios/${idCliente}/cargos`).set(auth(tokenAdmin)).send({ cargos: ['inexistente'] })).status).toBe(400);

    const r = await api.put(`/usuarios/${idCliente}/cargos`).set(auth(tokenAdmin)).send({ cargos: ['vendas'] });
    expect(r.status).toBe(200);
    expect(r.body.cargos).toEqual(['vendas']);

    const novo = (await logar('cliente')).body;
    expect(decodificar(novo.token).cargos).toEqual(['vendas']);
    expect((await api.get('/usuarios').set(auth(novo.token))).status).toBe(200); // vendas tem usuarios:listar

    await api.put(`/usuarios/${idCliente}/cargos`).set(auth(tokenAdmin)).send({ cargos: ['cliente'] });
  });
});

describe('gestão de usuários pelo administrador', () => {
  let idAlvo = 0;

  beforeAll(async () => {
    idAlvo = (await cadastrar('alvo')).body.id_usuario;
  });

  it('só quem tem permissão edita; e-mail repetido e corpo vazio são recusados', async () => {
    expect((await api.patch(`/usuarios/${idAlvo}`).set(auth(tokenCliente)).send({ nome: 'x' })).status).toBe(403);
    const ok = await api.patch(`/usuarios/${idAlvo}`).set(auth(tokenAdmin)).send({ nome: 'Nome Corrigido', telefone: '(44) 3333-4444' });
    expect(ok.status).toBe(200);
    expect(ok.body.nome).toBe('Nome Corrigido');
    expect((await api.patch(`/usuarios/${idAlvo}`).set(auth(tokenAdmin)).send({ email: email('admin') })).status).toBe(409);
    expect((await api.patch(`/usuarios/${idAlvo}`).set(auth(tokenAdmin)).send({})).status).toBe(400);
  });

  it('desativar conta bloqueia login e refresh; reativar devolve o acesso', async () => {
    const { refreshToken } = (await logar('alvo')).body;
    expect((await api.patch(`/usuarios/${idAlvo}/status`).set(auth(tokenAdmin)).send({ ativo: 'sim' })).status).toBe(400);
    expect((await api.patch(`/usuarios/${idAlvo}/status`).set(auth(tokenAdmin)).send({ ativo: false })).status).toBe(200);

    expect((await logar('alvo')).status).toBe(403);
    expect((await api.post('/auth/refresh').send({ refreshToken })).status).toBe(401);

    const inativos = await api.get('/usuarios?ativo=false').set(auth(tokenAdmin));
    expect(inativos.body.dados.some((u: { id_usuario: number }) => u.id_usuario === idAlvo)).toBe(true);

    expect((await api.patch(`/usuarios/${idAlvo}/status`).set(auth(tokenAdmin)).send({ ativo: true })).status).toBe(200);
    expect((await logar('alvo')).status).toBe(200);
  });

  it('exclusão é lógica: a linha continua existindo, inativa', async () => {
    expect((await api.delete(`/usuarios/${idAlvo}`).set(auth(tokenCliente))).status).toBe(403);
    expect((await api.delete(`/usuarios/${idAlvo}`).set(auth(tokenAdmin))).status).toBe(204);
    const r = await api.get(`/usuarios/${idAlvo}`).set(auth(tokenAdmin));
    expect(r.status).toBe(200);
    expect(r.body.ativo).toBe(false);
  });

  it('o administrador não consegue desativar nem excluir a si mesmo', async () => {
    expect((await api.patch(`/usuarios/${idAdmin}/status`).set(auth(tokenAdmin)).send({ ativo: false })).status).toBe(409);
    expect((await api.delete(`/usuarios/${idAdmin}`).set(auth(tokenAdmin))).status).toBe(409);
  });
});

describe('CRUD de cargos e permissões (RF05, RF06)', () => {
  const nomeCargo = `teste-${run}`;
  let idCargo = 0;

  it('cliente não acessa a administração de cargos/permissões', async () => {
    expect((await api.get('/cargos').set(auth(tokenCliente))).status).toBe(403);
    expect((await api.get('/permissoes').set(auth(tokenCliente))).status).toBe(403);
  });

  it('cria cargo com permissões e rejeita nome inválido, duplicado ou permissão inexistente', async () => {
    expect((await api.post('/cargos').set(auth(tokenAdmin)).send({ nome: 'Nome Inválido' })).status).toBe(400);
    expect((await api.post('/cargos').set(auth(tokenAdmin)).send({ nome: nomeCargo, permissoes: ['nao:existe'] })).status).toBe(400);

    const r = await api.post('/cargos').set(auth(tokenAdmin)).send({ nome: nomeCargo, permissoes: ['painel:acessar', 'dashboard:ver'] });
    expect(r.status).toBe(201);
    expect(r.body.permissoes).toEqual(['dashboard:ver', 'painel:acessar']);
    idCargo = r.body.id_cargo;

    expect((await api.post('/cargos').set(auth(tokenAdmin)).send({ nome: nomeCargo })).status).toBe(409);
  });

  it('lê, renomeia e troca as permissões do cargo (inclusive esvaziar)', async () => {
    expect((await api.get(`/cargos/${idCargo}`).set(auth(tokenAdmin))).status).toBe(200);
    expect((await api.get('/cargos/99999999').set(auth(tokenAdmin))).status).toBe(404);

    const renomeado = await api.patch(`/cargos/${idCargo}`).set(auth(tokenAdmin)).send({ nome: `${nomeCargo}-b` });
    expect(renomeado.status).toBe(200);

    const troca = await api.put(`/cargos/${idCargo}/permissoes`).set(auth(tokenAdmin)).send({ permissoes: ['usuarios:listar'] });
    expect(troca.body.permissoes).toEqual(['usuarios:listar']);

    const vazio = await api.put(`/cargos/${idCargo}/permissoes`).set(auth(tokenAdmin)).send({ permissoes: [] });
    expect(vazio.body.permissoes).toEqual([]);
  });

  it('protege os cargos do sistema', async () => {
    const lista = (await api.get('/cargos').set(auth(tokenAdmin))).body as { id_cargo: number; nome: string; protegido: boolean }[];
    const admin = lista.find((c) => c.nome === 'administrador')!;
    const cliente = lista.find((c) => c.nome === 'cliente')!;
    expect(admin.protegido).toBe(true);

    expect((await api.patch(`/cargos/${admin.id_cargo}`).set(auth(tokenAdmin)).send({ nome: 'outro' })).status).toBe(409);
    expect((await api.delete(`/cargos/${cliente.id_cargo}`).set(auth(tokenAdmin))).status).toBe(409);
    expect((await api.put(`/cargos/${admin.id_cargo}/permissoes`).set(auth(tokenAdmin)).send({ permissoes: [] })).status).toBe(409);
  });

  it('não exclui cargo em uso; exclui depois de liberado', async () => {
    const idUsuario = (await cadastrar('cargouso')).body.id_usuario;
    await api.put(`/usuarios/${idUsuario}/cargos`).set(auth(tokenAdmin)).send({ cargos: [`${nomeCargo}-b`] });
    expect((await api.delete(`/cargos/${idCargo}`).set(auth(tokenAdmin))).status).toBe(409);

    await api.put(`/usuarios/${idUsuario}/cargos`).set(auth(tokenAdmin)).send({ cargos: ['cliente'] });
    expect((await api.delete(`/cargos/${idCargo}`).set(auth(tokenAdmin))).status).toBe(204);
    expect((await api.get(`/cargos/${idCargo}`).set(auth(tokenAdmin))).status).toBe(404);
  });

  it('permissões: cria (admin recebe automático), renomeia, e protege as do sistema', async () => {
    expect((await api.post('/permissoes').set(auth(tokenAdmin)).send({ nome: 'Relatorio Vendas' })).status).toBe(400);

    const nome = `teste:${run}`;
    const criada = await api.post('/permissoes').set(auth(tokenAdmin)).send({ nome });
    expect(criada.status).toBe(201);
    expect(criada.body.do_sistema).toBe(false);
    expect((await api.post('/permissoes').set(auth(tokenAdmin)).send({ nome })).status).toBe(409);

    const loginAdmin = await logar('admin');
    expect(loginAdmin.body.usuario.permissoes).toContain(nome);

    const idPerm = criada.body.id_permissao;
    const renomeada = await api.patch(`/permissoes/${idPerm}`).set(auth(tokenAdmin)).send({ nome: `${nome}-b` });
    expect(renomeada.status).toBe(200);

    const sistema = (await api.get('/permissoes').set(auth(tokenAdmin))).body.find(
      (p: { nome: string }) => p.nome === 'painel:acessar'
    );
    expect(sistema.do_sistema).toBe(true);
    expect((await api.patch(`/permissoes/${sistema.id_permissao}`).set(auth(tokenAdmin)).send({ nome: 'x:y' })).status).toBe(409);
    expect((await api.delete(`/permissoes/${sistema.id_permissao}`).set(auth(tokenAdmin))).status).toBe(409);

    expect((await api.delete(`/permissoes/${idPerm}`).set(auth(tokenAdmin))).status).toBe(204);
  });
});

describe('endereços (RF38, RF39)', () => {
  let id1 = 0;
  let id2 = 0;
  const rota = () => `/usuarios/${idCliente}/enderecos`;
  const dados = { endereco: 'Rua A', numero: '10', cidade: 'Corbélia', estado: 'pr', cep: '85420-000' };

  it('o primeiro endereço nasce principal e os dados são normalizados', async () => {
    const r = await api.post(rota()).set(auth(tokenCliente)).send(dados);
    expect(r.status).toBe(201);
    expect(r.body.principal).toBe(true);
    expect(r.body.estado).toBe('PR');
    expect(r.body.cep).toBe('85420000');
    id1 = r.body.id_endereco;

    const r2 = await api.post(rota()).set(auth(tokenCliente)).send({ ...dados, endereco: 'Rua B', cidade: 'Cascavel', cep: '85800000' });
    expect(r2.body.principal).toBe(false);
    id2 = r2.body.id_endereco;

    expect((await api.post(rota()).set(auth(tokenCliente)).send({ ...dados, estado: 'PRR', cep: '123' })).status).toBe(400);
  });

  it('só o dono escreve; o admin pode ler, mas não escrever no endereço de outro', async () => {
    expect((await api.get(`/usuarios/${idAdmin}/enderecos`).set(auth(tokenCliente))).status).toBe(403);
    expect((await api.post(rota()).set(auth(tokenAdmin)).send(dados)).status).toBe(403);
    expect((await api.get(rota()).set(auth(tokenAdmin))).status).toBe(200);
  });

  it('busca um endereço específico', async () => {
    expect((await api.get(`${rota()}/${id1}`).set(auth(tokenCliente))).status).toBe(200);
    expect((await api.get(`${rota()}/${id1}`).set(auth(tokenAdmin))).status).toBe(200);
    expect((await api.get(`${rota()}/99999999`).set(auth(tokenCliente))).status).toBe(404);
  });

  it('troca o principal: sempre exatamente um, e ele vem primeiro na lista', async () => {
    expect((await api.patch(`${rota()}/${id2}/principal`).set(auth(tokenCliente))).status).toBe(200);
    const lista = (await api.get(rota()).set(auth(tokenCliente))).body as { id_endereco: number; principal: boolean }[];
    expect(lista.filter((e) => e.principal).map((e) => e.id_endereco)).toEqual([id2]);
    expect(lista[0].id_endereco).toBe(id2);
  });

  it('edita (RF39), mas não deixa o usuário sem endereço principal', async () => {
    expect((await api.patch(`${rota()}/${id1}`).set(auth(tokenCliente)).send({ numero: '11' })).status).toBe(200);
    expect((await api.patch(`${rota()}/${id2}`).set(auth(tokenCliente)).send({ principal: false })).status).toBe(400);
    expect((await api.patch(`${rota()}/${id1}`).set(auth(tokenCliente)).send({})).status).toBe(400);
  });

  it('apagar o principal promove o que sobrou', async () => {
    expect((await api.delete(`${rota()}/${id2}`).set(auth(tokenCliente))).status).toBe(204);
    const lista = (await api.get(rota()).set(auth(tokenCliente))).body as { principal: boolean }[];
    expect(lista).toHaveLength(1);
    expect(lista[0].principal).toBe(true);
    expect((await api.delete(`${rota()}/${id2}`).set(auth(tokenCliente))).status).toBe(404);
  });
});

describe('observabilidade (RNF05, RNF11)', () => {
  it('liveness e readiness (banco e redis)', async () => {
    expect((await api.get('/health/live')).status).toBe(200);
    const r = await api.get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', banco: 'ok', redis: 'ok' });
  });

  it('rota inexistente devolve 404 em JSON', async () => {
    const r = await api.get('/rota/que/nao/existe');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ erro: 'Rota não encontrada' });
  });

  it('propaga o x-correlation-id recebido e gera um quando não vem', async () => {
    expect((await api.get('/health/live').set('x-correlation-id', 'abc-123')).headers['x-correlation-id']).toBe('abc-123');
    expect((await api.get('/health/live')).headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('métricas exigem token e usam o padrão da rota (sem ids)', async () => {
    expect((await api.get('/metrics')).status).toBe(401);
    const r = await api.get('/metrics').set('Authorization', 'Bearer token-de-teste');
    expect(r.status).toBe(200);
    expect(r.text).toContain('http_requisicoes_total');
    expect(r.text).toContain('identidade_eventos_total{evento="login_ok"');
    expect(r.text).not.toMatch(/rota="[^"]*\/\d+/); // nada de /usuarios/123
  });
});
