import { UniqueConstraintError } from 'sequelize';
import { Cargo, Permissao, CargoPermissao } from '../models';
import { sequelize } from '../config/database';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { nomeCargoAdmin, permissoesDoSistema } from '../config/rbac';

const ehDoSistema = (nome: string) => (permissoesDoSistema as readonly string[]).includes(nome);

async function obterPermissaoOuFalhar(id: number) {
  const permissao = await Permissao.findByPk(id);
  if (!permissao) {
    throw new ErroHttp(404, 'Permissão não existe');
  }
  return permissao;
}

async function exigirEditavel(permissao: Permissao, acao: string) {
  if (ehDoSistema(permissao.nome)) {
    throw new ErroHttp(409, `A permissão "${permissao.nome}" é do sistema e não pode ${acao}`);
  }
  const cargos = await Cargo.findAll({
    include: [{ model: Permissao, as: 'permissoes', where: { id_permissao: permissao.id_permissao }, required: true }],
  });
  const dependentes = cargos.filter((c) => c.nome !== nomeCargoAdmin).map((c) => c.nome);
  if (dependentes.length > 0) {
    throw new ErroHttp(409, `A permissão está em uso pelo(s) cargo(s): ${dependentes.join(', ')}`);
  }
}

function paraResposta(permissao: Permissao) {
  return { id_permissao: permissao.id_permissao, nome: permissao.nome, do_sistema: ehDoSistema(permissao.nome) };
}

export async function listarPermissoes() {
  const permissoes = await Permissao.findAll({ order: [['nome', 'ASC']] });
  return permissoes.map(paraResposta);
}

export async function buscarPermissao(id: number) {
  return paraResposta(await obterPermissaoOuFalhar(id));
}

export async function criarPermissao(nome: string, criadoPor: number) {
  try {
    const permissao = await sequelize.transaction(async (transaction) => {
      const nova = await Permissao.create({ nome }, { transaction });
      const admin = await Cargo.findOne({ where: { nome: nomeCargoAdmin }, transaction });
      if (admin) {
        await CargoPermissao.create({ id_cargo: admin.id_cargo, id_permissao: nova.id_permissao }, { transaction });
      }
      return nova;
    });
    logger.info({ id_permissao: permissao.id_permissao, nome, criadoPor }, 'permissão criada');
    return paraResposta(permissao);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma permissão com esse nome');
    }
    throw err;
  }
}

export async function renomearPermissao(id: number, nome: string, alteradoPor: number) {
  const permissao = await obterPermissaoOuFalhar(id);
  await exigirEditavel(permissao, 'ser renomeada');

  try {
    await permissao.update({ nome });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma permissão com esse nome');
    }
    throw err;
  }
  logger.info({ id_permissao: id, nome, alteradoPor }, 'permissão renomeada');
  return paraResposta(permissao);
}

export async function excluirPermissao(id: number, excluidoPor: number) {
  const permissao = await obterPermissaoOuFalhar(id);
  await exigirEditavel(permissao, 'ser excluída');

  await sequelize.transaction(async (transaction) => {
    await CargoPermissao.destroy({ where: { id_permissao: id }, transaction });
    await permissao.destroy({ transaction });
  });
  logger.info({ id_permissao: id, nome: permissao.nome, excluidoPor }, 'permissão excluída');
}
