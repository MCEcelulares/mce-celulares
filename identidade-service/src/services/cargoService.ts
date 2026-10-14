import { UniqueConstraintError } from 'sequelize';
import { Cargo, Permissao, UsuarioCargo, CargoPermissao } from '../models';
import { sequelize } from '../config/database';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { cargosProtegidos, nomeCargoAdmin } from '../config/rbac';
import { CriarCargoInput } from '../validators/cargoValidators';

const incluirPermissoes = [
  { model: Permissao, as: 'permissoes', attributes: ['nome'], through: { attributes: [] } },
];

function paraResposta(cargo: Cargo) {
  return {
    id_cargo: cargo.id_cargo,
    nome: cargo.nome,
    protegido: (cargosProtegidos as readonly string[]).includes(cargo.nome),
    permissoes: (cargo.permissoes ?? []).map((p) => p.nome).sort(),
  };
}

async function obterCargoOuFalhar(id: number) {
  const cargo = await Cargo.findByPk(id, { include: incluirPermissoes });
  if (!cargo) {
    throw new ErroHttp(404, 'Cargo não existe');
  }
  return cargo;
}

function exigirNaoProtegido(cargo: Cargo, acao: string) {
  if ((cargosProtegidos as readonly string[]).includes(cargo.nome)) {
    throw new ErroHttp(409, `O cargo "${cargo.nome}" é do sistema e não pode ${acao}`);
  }
}

async function buscarPermissoesPorNome(nomes: string[]) {
  const unicos = [...new Set(nomes)];
  const permissoes = await Permissao.findAll({ where: { nome: unicos } });
  const inexistentes = unicos.filter((n) => !permissoes.some((p) => p.nome === n));
  if (inexistentes.length > 0) {
    throw new ErroHttp(400, `Permissão(ões) inexistente(s): ${inexistentes.join(', ')}`);
  }
  return permissoes;
}

export async function listarCargos() {
  const cargos = await Cargo.findAll({ include: incluirPermissoes, order: [['id_cargo', 'ASC']] });
  return cargos.map(paraResposta);
}

export async function buscarCargo(id: number) {
  return paraResposta(await obterCargoOuFalhar(id));
}

export async function criarCargo(dados: CriarCargoInput, criadoPor: number) {
  const permissoes = dados.permissoes ? await buscarPermissoesPorNome(dados.permissoes) : [];

  let id: number;
  try {
    const cargo = await sequelize.transaction(async (transaction) => {
      const novo = await Cargo.create({ nome: dados.nome }, { transaction });
      if (permissoes.length > 0) {
        await CargoPermissao.bulkCreate(
          permissoes.map((p) => ({ id_cargo: novo.id_cargo, id_permissao: p.id_permissao })),
          { transaction }
        );
      }
      return novo;
    });
    id = cargo.id_cargo;
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe um cargo com esse nome');
    }
    throw err;
  }

  logger.info({ id_cargo: id, nome: dados.nome, criadoPor }, 'cargo criado');
  return paraResposta(await obterCargoOuFalhar(id));
}

export async function renomearCargo(id: number, nome: string, alteradoPor: number) {
  const cargo = await obterCargoOuFalhar(id);
  exigirNaoProtegido(cargo, 'ser renomeado');

  try {
    await cargo.update({ nome });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe um cargo com esse nome');
    }
    throw err;
  }
  logger.info({ id_cargo: id, nome, alteradoPor }, 'cargo renomeado');
  return paraResposta(cargo);
}

export async function excluirCargo(id: number, excluidoPor: number) {
  const cargo = await obterCargoOuFalhar(id);
  exigirNaoProtegido(cargo, 'ser excluído');

  const emUso = await UsuarioCargo.count({ where: { id_cargo: id } });
  if (emUso > 0) {
    throw new ErroHttp(409, `O cargo está atribuído a ${emUso} usuário(s). Remova-o deles antes de excluir`);
  }

  await sequelize.transaction(async (transaction) => {
    await CargoPermissao.destroy({ where: { id_cargo: id }, transaction });
    await cargo.destroy({ transaction });
  });
  logger.info({ id_cargo: id, nome: cargo.nome, excluidoPor }, 'cargo excluído');
}

export async function definirPermissoesDoCargo(id: number, nomes: string[], alteradoPor: number) {
  const cargo = await obterCargoOuFalhar(id);

  if (cargo.nome === nomeCargoAdmin) {
    throw new ErroHttp(409, 'As permissões do cargo "administrador" não podem ser alteradas');
  }

  const permissoes = await buscarPermissoesPorNome(nomes);
  await sequelize.transaction(async (transaction) => {
    await CargoPermissao.destroy({ where: { id_cargo: id }, transaction });
    if (permissoes.length > 0) {
      await CargoPermissao.bulkCreate(
        permissoes.map((p) => ({ id_cargo: id, id_permissao: p.id_permissao })),
        { transaction }
      );
    }
  });

  logger.info({ id_cargo: id, permissoes: permissoes.map((p) => p.nome), alteradoPor }, 'permissões do cargo atualizadas');
  return paraResposta(await obterCargoOuFalhar(id));
}
