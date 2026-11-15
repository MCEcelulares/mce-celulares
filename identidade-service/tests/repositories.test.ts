import { Op } from 'sequelize';
import { sequelize } from '../src/config/database';
import { Cargo, CargoPermissao, Endereco, Permissao, Usuario, UsuarioCargo } from '../src/models';
import * as usuarioRepository from '../src/repositories/usuarioRepository';
import * as cargoRepository from '../src/repositories/cargoRepository';
import * as permissaoRepository from '../src/repositories/permissaoRepository';
import * as enderecoRepository from '../src/repositories/enderecoRepository';
import { RegistroDuplicadoError } from '../src/repositories/erros';
import { comTransacao } from '../src/repositories/transacao';

const run = Date.now().toString(36);
const email = (nome: string) => `${nome}-repo-${run}@mce.test`;
const nomeCargo = (nome: string) => `repo-${run}-${nome}`;
const nomePermissao = (nome: string) => `repo:${run}:${nome}`;

const criarUsuario = (nome: string, extra: Record<string, unknown> = {}) =>
  usuarioRepository.criar({ nome: `Teste ${nome}`, email: email(nome), senha: 'hash', ...extra });

const novoEndereco = (idUsuario: number, principal: boolean, rua = 'Rua A') => ({
  id_usuario: idUsuario,
  principal,
  endereco: rua,
  numero: '10',
  cidade: 'Campo Mourão',
  estado: 'PR',
  cep: '87300000',
});

afterAll(async () => {
  const usuarios = await Usuario.findAll({ where: { email: { [Op.like]: `%-repo-${run}@mce.test` } } });
  const ids = usuarios.map((u) => u.id_usuario);
  await Endereco.destroy({ where: { id_usuario: ids } });
  await UsuarioCargo.destroy({ where: { id_usuario: ids } });
  await Usuario.destroy({ where: { id_usuario: ids } });

  const cargos = await Cargo.findAll({ where: { nome: { [Op.like]: `repo-${run}%` } } });
  const idsCargos = cargos.map((c) => c.id_cargo);
  await UsuarioCargo.destroy({ where: { id_cargo: idsCargos } });
  await CargoPermissao.destroy({ where: { id_cargo: idsCargos } });
  await Cargo.destroy({ where: { id_cargo: idsCargos } });

  const permissoes = await Permissao.findAll({ where: { nome: { [Op.like]: `repo:${run}%` } } });
  await CargoPermissao.destroy({ where: { id_permissao: permissoes.map((p) => p.id_permissao) } });
  await Permissao.destroy({ where: { id_permissao: permissoes.map((p) => p.id_permissao) } });
  await sequelize.close();
});

describe('usuarioRepository', () => {
  it('cria, busca por id, e-mail e googleId', async () => {
    const u = await criarUsuario('busca', { googleId: `g-${run}` });
    expect((await usuarioRepository.buscarPorId(u.id_usuario))?.email).toBe(email('busca'));
    expect((await usuarioRepository.buscarPorEmail(email('busca')))?.id_usuario).toBe(u.id_usuario);
    expect((await usuarioRepository.buscarPorGoogleId(`g-${run}`))?.id_usuario).toBe(u.id_usuario);
    expect(await usuarioRepository.buscarPorEmail(email('nao-existe'))).toBeNull();
  });

  it('e-mail repetido vira RegistroDuplicadoError ao criar e ao atualizar', async () => {
    await criarUsuario('duplicado');
    await expect(criarUsuario('duplicado')).rejects.toBeInstanceOf(RegistroDuplicadoError);

    const outro = await criarUsuario('duplicado-b');
    await expect(usuarioRepository.atualizar(outro, { email: email('duplicado') })).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
  });

  it('atualiza campos', async () => {
    const u = await criarUsuario('atualiza');
    await usuarioRepository.atualizar(u, { nome: 'Novo Nome', ativo: false });
    const lido = await usuarioRepository.buscarPorId(u.id_usuario);
    expect(lido?.nome).toBe('Novo Nome');
    expect(lido?.ativo).toBe(false);
  });

  it('adiciona e substitui cargos e diz se o usuário possui um cargo', async () => {
    const cargoA = await comTransacao((t) => cargoRepository.criar(nomeCargo('a'), t));
    const cargoB = await comTransacao((t) => cargoRepository.criar(nomeCargo('b'), t));
    const u = await criarUsuario('cargos');

    expect(await usuarioRepository.possuiCargo(u.id_usuario, cargoA.id_cargo)).toBe(false);
    await usuarioRepository.adicionarCargo(u, cargoA);
    expect(await usuarioRepository.possuiCargo(u.id_usuario, cargoA.id_cargo)).toBe(true);

    await usuarioRepository.definirCargos(u, [cargoB]);
    expect(await usuarioRepository.possuiCargo(u.id_usuario, cargoA.id_cargo)).toBe(false);
    expect(await usuarioRepository.possuiCargo(u.id_usuario, cargoB.id_cargo)).toBe(true);
  });

  it('conta só os usuários ATIVOS que têm o cargo', async () => {
    const cargo = await comTransacao((t) => cargoRepository.criar(nomeCargo('contagem'), t));
    const ativo = await criarUsuario('ativo-contagem');
    const inativo = await criarUsuario('inativo-contagem', { ativo: false });
    await usuarioRepository.adicionarCargo(ativo, cargo);
    await usuarioRepository.adicionarCargo(inativo, cargo);

    expect(await usuarioRepository.contarAtivosComCargo(cargo.nome)).toBe(1);
  });

  it('lista com busca, status, cargo e paginação, sem expor a senha', async () => {
    const cargo = await comTransacao((t) => cargoRepository.criar(nomeCargo('listagem'), t));
    const a = await criarUsuario('lista-a');
    const b = await criarUsuario('lista-b', { ativo: false });
    await usuarioRepository.adicionarCargo(a, cargo);

    const base = { page: 1, limit: 50 };
    const porBusca = await usuarioRepository.listar({ ...base, busca: `lista-a-repo-${run}` });
    expect(porBusca.registros.map((r) => r.id_usuario)).toEqual([a.id_usuario]);
    expect(porBusca.registros[0].get('senha')).toBeUndefined();

    const inativos = await usuarioRepository.listar({ ...base, busca: `-repo-${run}`, ativo: false });
    expect(inativos.registros.map((r) => r.id_usuario)).toContain(b.id_usuario);
    expect(inativos.registros.every((r) => r.ativo === false)).toBe(true);

    const porCargo = await usuarioRepository.listar({ ...base, cargo: cargo.nome });
    expect(porCargo.total).toBe(1);
    expect(porCargo.registros[0].cargos?.[0].nome).toBe(cargo.nome);

    const pagina = await usuarioRepository.listar({ page: 2, limit: 1, busca: `-repo-${run}` });
    expect(pagina.registros).toHaveLength(1);
    expect(pagina.total).toBeGreaterThan(1);
  });

  it('carrega o usuário com os cargos e as permissões de cada cargo', async () => {
    const permissao = await comTransacao((t) => permissaoRepository.criar(nomePermissao('acesso'), t));
    const cargo = await comTransacao(async (t) => {
      const novo = await cargoRepository.criar(nomeCargo('com-permissao'), t);
      await cargoRepository.vincularPermissoes(novo.id_cargo, [permissao.id_permissao], t);
      return novo;
    });
    const u = await criarUsuario('acesso');
    await usuarioRepository.adicionarCargo(u, cargo);

    const completo = await usuarioRepository.buscarComCargosEPermissoes(u.id_usuario);
    expect(completo?.cargos?.map((c) => c.nome)).toEqual([cargo.nome]);
    expect(completo?.cargos?.[0].permissoes?.map((p) => p.nome)).toEqual([permissao.nome]);
  });
});

describe('cargoRepository e permissaoRepository', () => {
  it('nome repetido vira RegistroDuplicadoError (cargo e permissão, ao criar e ao renomear)', async () => {
    const cargo = await comTransacao((t) => cargoRepository.criar(nomeCargo('unico'), t));
    await expect(comTransacao((t) => cargoRepository.criar(nomeCargo('unico'), t))).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
    const outro = await comTransacao((t) => cargoRepository.criar(nomeCargo('unico-b'), t));
    await expect(cargoRepository.renomear(outro, cargo.nome)).rejects.toBeInstanceOf(RegistroDuplicadoError);

    const permissao = await comTransacao((t) => permissaoRepository.criar(nomePermissao('unica'), t));
    await expect(comTransacao((t) => permissaoRepository.criar(nomePermissao('unica'), t))).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
    const outra = await comTransacao((t) => permissaoRepository.criar(nomePermissao('unica-b'), t));
    await expect(permissaoRepository.renomear(outra, permissao.nome)).rejects.toBeInstanceOf(RegistroDuplicadoError);
  });

  it('busca cargos por nome (um ou vários, dentro ou fora de transação)', async () => {
    const a = await comTransacao((t) => cargoRepository.criar(nomeCargo('busca-a'), t));
    const b = await comTransacao((t) => cargoRepository.criar(nomeCargo('busca-b'), t));

    expect((await cargoRepository.buscarPorNome(a.nome))?.id_cargo).toBe(a.id_cargo);
    expect(await cargoRepository.buscarPorNome(nomeCargo('nao-existe'))).toBeNull();
    const dentro = await comTransacao((t) => cargoRepository.buscarPorNome(b.nome, t));
    expect(dentro?.id_cargo).toBe(b.id_cargo);

    const varios = await cargoRepository.buscarPorNomes([a.nome, b.nome, nomeCargo('nao-existe')]);
    expect(varios.map((c) => c.id_cargo).sort()).toEqual([a.id_cargo, b.id_cargo].sort());
  });

  it('vincula, troca e remove as permissões de um cargo, e lista os cargos de uma permissão', async () => {
    const p1 = await comTransacao((t) => permissaoRepository.criar(nomePermissao('v1'), t));
    const p2 = await comTransacao((t) => permissaoRepository.criar(nomePermissao('v2'), t));
    const cargo = await comTransacao(async (t) => {
      const novo = await cargoRepository.criar(nomeCargo('vinculos'), t);
      await cargoRepository.vincularPermissoes(novo.id_cargo, [p1.id_permissao, p2.id_permissao], t);
      return novo;
    });

    const lido = await cargoRepository.buscarPorIdComPermissoes(cargo.id_cargo);
    expect(lido?.permissoes?.map((p) => p.nome).sort()).toEqual([p1.nome, p2.nome].sort());
    expect((await cargoRepository.listarComPermissao(p1.id_permissao)).map((c) => c.id_cargo)).toEqual([
      cargo.id_cargo,
    ]);
    expect((await cargoRepository.listarComPermissoes()).some((c) => c.id_cargo === cargo.id_cargo)).toBe(true);

    await comTransacao(async (t) => {
      await cargoRepository.removerVinculosDoCargo(cargo.id_cargo, t);
      await cargoRepository.vincularPermissoes(cargo.id_cargo, [p2.id_permissao], t);
    });
    const depois = await cargoRepository.buscarPorIdComPermissoes(cargo.id_cargo);
    expect(depois?.permissoes?.map((p) => p.nome)).toEqual([p2.nome]);

    await comTransacao((t) => cargoRepository.removerVinculosDaPermissao(p2.id_permissao, t));
    expect((await cargoRepository.buscarPorIdComPermissoes(cargo.id_cargo))?.permissoes).toHaveLength(0);
  });

  it('conta os usuários do cargo e exclui o cargo e a permissão', async () => {
    const cargo = await comTransacao((t) => cargoRepository.criar(nomeCargo('exclusao'), t));
    const u = await criarUsuario('exclusao');
    await usuarioRepository.adicionarCargo(u, cargo);
    expect(await cargoRepository.contarUsuarios(cargo.id_cargo)).toBe(1);

    await usuarioRepository.definirCargos(u, []);
    expect(await cargoRepository.contarUsuarios(cargo.id_cargo)).toBe(0);

    await comTransacao((t) => cargoRepository.excluir(cargo, t));
    expect(await cargoRepository.buscarPorIdComPermissoes(cargo.id_cargo)).toBeNull();

    const permissao = await comTransacao((t) => permissaoRepository.criar(nomePermissao('exclusao'), t));
    expect((await permissaoRepository.buscarPorId(permissao.id_permissao))?.nome).toBe(permissao.nome);
    await comTransacao((t) => permissaoRepository.excluir(permissao, t));
    expect(await permissaoRepository.buscarPorId(permissao.id_permissao)).toBeNull();
  });

  it('busca permissões por nome, lista em ordem e liga uma permissão nova a um cargo', async () => {
    const cargo = await comTransacao((t) => cargoRepository.criar(nomeCargo('ligacao'), t));
    const permissao = await comTransacao(async (t) => {
      const nova = await permissaoRepository.criar(nomePermissao('ligacao'), t);
      await permissaoRepository.vincularAoCargo(cargo.id_cargo, nova.id_permissao, t);
      return nova;
    });

    expect((await permissaoRepository.buscarPorNomes([permissao.nome, 'nao:existe'])).map((p) => p.nome)).toEqual([
      permissao.nome,
    ]);
    const nomes = (await permissaoRepository.listar()).map((p) => p.nome);
    expect(nomes).toEqual([...nomes].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })));
    expect((await cargoRepository.listarComPermissao(permissao.id_permissao)).map((c) => c.id_cargo)).toEqual([
      cargo.id_cargo,
    ]);
  });

  it('desfaz tudo se a transação falhar', async () => {
    await expect(
      comTransacao(async (t) => {
        await cargoRepository.criar(nomeCargo('rollback'), t);
        throw new Error('falha no meio');
      })
    ).rejects.toThrow('falha no meio');
    expect(await cargoRepository.buscarPorNome(nomeCargo('rollback'))).toBeNull();
  });
});

describe('enderecoRepository', () => {
  it('cria, busca por dono e lista com o principal primeiro', async () => {
    const u = await criarUsuario('endereco');
    const outro = await criarUsuario('endereco-outro');
    const e1 = await comTransacao((t) => enderecoRepository.criar(novoEndereco(u.id_usuario, false, 'Rua 1'), t));
    const e2 = await comTransacao((t) => enderecoRepository.criar(novoEndereco(u.id_usuario, true, 'Rua 2'), t));

    expect((await enderecoRepository.listarDoUsuario(u.id_usuario)).map((e) => e.id_endereco)).toEqual([
      e2.id_endereco,
      e1.id_endereco,
    ]);
    expect((await enderecoRepository.buscar(u.id_usuario, e1.id_endereco))?.endereco).toBe('Rua 1');
    expect(await enderecoRepository.buscar(outro.id_usuario, e1.id_endereco)).toBeNull();
  });

  it('conta, desmarca os principais, atualiza e acha o mais antigo', async () => {
    const u = await criarUsuario('endereco-principal');
    const { e1, e2 } = await comTransacao(async (t) => {
      const primeiro = await enderecoRepository.criar(novoEndereco(u.id_usuario, true, 'Rua 1'), t);
      const segundo = await enderecoRepository.criar(novoEndereco(u.id_usuario, false, 'Rua 2'), t);
      return { e1: primeiro, e2: segundo };
    });

    await comTransacao(async (t) => {
      expect(await enderecoRepository.contarDoUsuario(u.id_usuario, t)).toBe(2);
      await enderecoRepository.desmarcarPrincipais(u.id_usuario, t);
      await enderecoRepository.atualizar(e2, { principal: true, numero: '99' }, t);
      expect((await enderecoRepository.buscarMaisAntigo(u.id_usuario, t))?.id_endereco).toBe(e1.id_endereco);
    });

    const lista = await enderecoRepository.listarDoUsuario(u.id_usuario);
    expect(lista[0].id_endereco).toBe(e2.id_endereco);
    expect(lista[0].numero).toBe('99');
    expect(lista[1].principal).toBe(false);
  });

  it('remove o endereço', async () => {
    const u = await criarUsuario('endereco-remocao');
    const e = await comTransacao((t) => enderecoRepository.criar(novoEndereco(u.id_usuario, true), t));
    await comTransacao((t) => enderecoRepository.remover(e, t));
    expect(await enderecoRepository.buscar(u.id_usuario, e.id_endereco)).toBeNull();
  });
});
