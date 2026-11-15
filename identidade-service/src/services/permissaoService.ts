import type { Permissao } from '../models';
import * as permissaoRepository from '../repositories/permissaoRepository';
import * as cargoRepository from '../repositories/cargoRepository';
import { RegistroDuplicadoError } from '../repositories/erros';
import { comTransacao } from '../repositories/transacao';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { nomeCargoAdmin, permissoesDoSistema } from '../config/rbac';

const ehDoSistema = (nome: string) => (permissoesDoSistema as readonly string[]).includes(nome);

async function obterPermissaoOuFalhar(id: number) {
  const permissao = await permissaoRepository.buscarPorId(id);
  if (!permissao) {
    throw new ErroHttp(404, 'Permissão não existe');
  }
  return permissao;
}

async function exigirEditavel(permissao: Permissao, acao: string) {
  if (ehDoSistema(permissao.nome)) {
    throw new ErroHttp(409, `A permissão "${permissao.nome}" é do sistema e não pode ${acao}`);
  }
  const cargos = await cargoRepository.listarComPermissao(permissao.id_permissao);
  const dependentes = cargos.filter((c) => c.nome !== nomeCargoAdmin).map((c) => c.nome);
  if (dependentes.length > 0) {
    throw new ErroHttp(409, `A permissão está em uso pelo(s) cargo(s): ${dependentes.join(', ')}`);
  }
}

function paraResposta(permissao: Permissao) {
  return { id_permissao: permissao.id_permissao, nome: permissao.nome, do_sistema: ehDoSistema(permissao.nome) };
}

export async function listarPermissoes() {
  const permissoes = await permissaoRepository.listar();
  return permissoes.map(paraResposta);
}

export async function buscarPermissao(id: number) {
  return paraResposta(await obterPermissaoOuFalhar(id));
}

export async function criarPermissao(nome: string, criadoPor: number) {
  try {
    const permissao = await comTransacao(async (transacao) => {
      const nova = await permissaoRepository.criar(nome, transacao);
      const admin = await cargoRepository.buscarPorNome(nomeCargoAdmin, transacao);
      if (admin) {
        await permissaoRepository.vincularAoCargo(admin.id_cargo, nova.id_permissao, transacao);
      }
      return nova;
    });
    logger.info({ id_permissao: permissao.id_permissao, nome, criadoPor }, 'permissão criada');
    return paraResposta(permissao);
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
      throw new ErroHttp(409, 'Já existe uma permissão com esse nome');
    }
    throw err;
  }
}

export async function renomearPermissao(id: number, nome: string, alteradoPor: number) {
  const permissao = await obterPermissaoOuFalhar(id);
  await exigirEditavel(permissao, 'ser renomeada');

  try {
    await permissaoRepository.renomear(permissao, nome);
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
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

  await comTransacao(async (transacao) => {
    await cargoRepository.removerVinculosDaPermissao(id, transacao);
    await permissaoRepository.excluir(permissao, transacao);
  });
  logger.info({ id_permissao: id, nome: permissao.nome, excluidoPor }, 'permissão excluída');
}
