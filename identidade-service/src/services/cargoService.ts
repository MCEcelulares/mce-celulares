import type { Cargo } from '../models';
import * as cargoRepository from '../repositories/cargoRepository';
import * as permissaoRepository from '../repositories/permissaoRepository';
import { RegistroDuplicadoError } from '../repositories/erros';
import { comTransacao } from '../repositories/transacao';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { cargosProtegidos, nomeCargoAdmin } from '../config/rbac';
import { CriarCargoInput } from '../validators/cargoValidators';

function paraResposta(cargo: Cargo) {
  return {
    id_cargo: cargo.id_cargo,
    nome: cargo.nome,
    protegido: (cargosProtegidos as readonly string[]).includes(cargo.nome),
    permissoes: (cargo.permissoes ?? []).map((p) => p.nome).sort(),
  };
}

async function obterCargoOuFalhar(id: number) {
  const cargo = await cargoRepository.buscarPorIdComPermissoes(id);
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
  const permissoes = await permissaoRepository.buscarPorNomes(unicos);
  const inexistentes = unicos.filter((n) => !permissoes.some((p) => p.nome === n));
  if (inexistentes.length > 0) {
    throw new ErroHttp(400, `Permissão(ões) inexistente(s): ${inexistentes.join(', ')}`);
  }
  return permissoes;
}

export async function listarCargos() {
  const cargos = await cargoRepository.listarComPermissoes();
  return cargos.map(paraResposta);
}

export async function buscarCargo(id: number) {
  return paraResposta(await obterCargoOuFalhar(id));
}

export async function criarCargo(dados: CriarCargoInput, criadoPor: number) {
  const permissoes = dados.permissoes ? await buscarPermissoesPorNome(dados.permissoes) : [];

  let id: number;
  try {
    const cargo = await comTransacao(async (transacao) => {
      const novo = await cargoRepository.criar(dados.nome, transacao);
      if (permissoes.length > 0) {
        await cargoRepository.vincularPermissoes(
          novo.id_cargo,
          permissoes.map((p) => p.id_permissao),
          transacao
        );
      }
      return novo;
    });
    id = cargo.id_cargo;
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
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
    await cargoRepository.renomear(cargo, nome);
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
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

  const emUso = await cargoRepository.contarUsuarios(id);
  if (emUso > 0) {
    throw new ErroHttp(409, `O cargo está atribuído a ${emUso} usuário(s). Remova-o deles antes de excluir`);
  }

  await comTransacao(async (transacao) => {
    await cargoRepository.removerVinculosDoCargo(id, transacao);
    await cargoRepository.excluir(cargo, transacao);
  });
  logger.info({ id_cargo: id, nome: cargo.nome, excluidoPor }, 'cargo excluído');
}

export async function definirPermissoesDoCargo(id: number, nomes: string[], alteradoPor: number) {
  const cargo = await obterCargoOuFalhar(id);

  if (cargo.nome === nomeCargoAdmin) {
    throw new ErroHttp(409, 'As permissões do cargo "administrador" não podem ser alteradas');
  }

  const permissoes = await buscarPermissoesPorNome(nomes);
  await comTransacao(async (transacao) => {
    await cargoRepository.removerVinculosDoCargo(id, transacao);
    if (permissoes.length > 0) {
      await cargoRepository.vincularPermissoes(
        id,
        permissoes.map((p) => p.id_permissao),
        transacao
      );
    }
  });

  logger.info({ id_cargo: id, permissoes: permissoes.map((p) => p.nome), alteradoPor }, 'permissões do cargo atualizadas');
  return paraResposta(await obterCargoOuFalhar(id));
}
