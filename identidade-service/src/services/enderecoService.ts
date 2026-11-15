import * as enderecoRepository from '../repositories/enderecoRepository';
import * as usuarioRepository from '../repositories/usuarioRepository';
import { comTransacao } from '../repositories/transacao';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { CriarEnderecoInput, AtualizarEnderecoInput } from '../validators/enderecoValidators';

async function garantirUsuario(idUsuario: number) {
  const usuario = await usuarioRepository.buscarPorId(idUsuario);
  if (!usuario) {
    throw new ErroHttp(404, 'Usuário não existe');
  }
}

async function obterEnderecoOuFalhar(idUsuario: number, idEndereco: number) {
  const endereco = await enderecoRepository.buscar(idUsuario, idEndereco);
  if (!endereco) {
    throw new ErroHttp(404, 'Endereço não encontrado para esse usuário');
  }
  return endereco;
}

export async function listarEnderecos(idUsuario: number) {
  await garantirUsuario(idUsuario);
  return enderecoRepository.listarDoUsuario(idUsuario);
}

export async function buscarEndereco(idUsuario: number, idEndereco: number) {
  await garantirUsuario(idUsuario);
  return obterEnderecoOuFalhar(idUsuario, idEndereco);
}

export async function criarEndereco(idUsuario: number, dados: CriarEnderecoInput) {
  await garantirUsuario(idUsuario);

  return comTransacao(async (transacao) => {
    const total = await enderecoRepository.contarDoUsuario(idUsuario, transacao);
    const principal = dados.principal ?? total === 0;

    if (principal) {
      await enderecoRepository.desmarcarPrincipais(idUsuario, transacao);
    }

    const endereco = await enderecoRepository.criar({ ...dados, id_usuario: idUsuario, principal }, transacao);
    logger.info({ id_usuario: idUsuario, id_endereco: endereco.id_endereco }, 'endereço criado');
    return endereco;
  });
}

export async function atualizarEndereco(idUsuario: number, idEndereco: number, dados: AtualizarEnderecoInput) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  if (dados.principal === false && endereco.principal) {
    throw new ErroHttp(400, 'Para trocar o endereço principal, marque outro endereço como principal');
  }

  return comTransacao(async (transacao) => {
    if (dados.principal === true) {
      await enderecoRepository.desmarcarPrincipais(idUsuario, transacao);
    }
    await enderecoRepository.atualizar(endereco, dados, transacao);
    logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço atualizado');
    return endereco;
  });
}

export async function marcarEnderecoPrincipal(idUsuario: number, idEndereco: number) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  return comTransacao(async (transacao) => {
    await enderecoRepository.desmarcarPrincipais(idUsuario, transacao);
    await enderecoRepository.atualizar(endereco, { principal: true }, transacao);
    logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço principal definido');
    return endereco;
  });
}

export async function removerEndereco(idUsuario: number, idEndereco: number) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  await comTransacao(async (transacao) => {
    const eraPrincipal = endereco.principal;
    await enderecoRepository.remover(endereco, transacao);

    if (eraPrincipal) {
      const proximo = await enderecoRepository.buscarMaisAntigo(idUsuario, transacao);
      if (proximo) await enderecoRepository.atualizar(proximo, { principal: true }, transacao);
    }
  });

  logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço removido');
}
