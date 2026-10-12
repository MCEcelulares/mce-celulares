import { Endereco, Usuario } from '../models';
import { sequelize } from '../config/database';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { CriarEnderecoInput, AtualizarEnderecoInput } from '../validators/enderecoValidators';

async function garantirUsuario(idUsuario: number) {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) {
    throw new ErroHttp(404, 'Usuário não existe');
  }
}

async function obterEnderecoOuFalhar(idUsuario: number, idEndereco: number) {
  const endereco = await Endereco.findOne({ where: { id_endereco: idEndereco, id_usuario: idUsuario } });
  if (!endereco) {
    throw new ErroHttp(404, 'Endereço não encontrado para esse usuário');
  }
  return endereco;
}

export async function listarEnderecos(idUsuario: number) {
  await garantirUsuario(idUsuario);
  return Endereco.findAll({
    where: { id_usuario: idUsuario },
    order: [['principal', 'DESC'], ['id_endereco', 'ASC']], 
  });
}

export async function buscarEndereco(idUsuario: number, idEndereco: number) {
  await garantirUsuario(idUsuario);
  return obterEnderecoOuFalhar(idUsuario, idEndereco);
}

export async function criarEndereco(idUsuario: number, dados: CriarEnderecoInput) {
  await garantirUsuario(idUsuario);

  return sequelize.transaction(async (transaction) => {
    const total = await Endereco.count({ where: { id_usuario: idUsuario }, transaction });
    const principal = dados.principal ?? total === 0;

    if (principal) {
      await Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
    }

    const endereco = await Endereco.create({ ...dados, id_usuario: idUsuario, principal }, { transaction });
    logger.info({ id_usuario: idUsuario, id_endereco: endereco.id_endereco }, 'endereço criado');
    return endereco;
  });
}

export async function atualizarEndereco(idUsuario: number, idEndereco: number, dados: AtualizarEnderecoInput) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  if (dados.principal === false && endereco.principal) {
    throw new ErroHttp(400, 'Para trocar o endereço principal, marque outro endereço como principal');
  }

  return sequelize.transaction(async (transaction) => {
    if (dados.principal === true) {
      await Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
    }
    await endereco.update(dados, { transaction });
    logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço atualizado');
    return endereco;
  });
}

export async function marcarEnderecoPrincipal(idUsuario: number, idEndereco: number) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  return sequelize.transaction(async (transaction) => {
    await Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
    await endereco.update({ principal: true }, { transaction });
    logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço principal definido');
    return endereco;
  });
}

export async function removerEndereco(idUsuario: number, idEndereco: number) {
  const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);

  await sequelize.transaction(async (transaction) => {
    const eraPrincipal = endereco.principal;
    await endereco.destroy({ transaction });

    if (eraPrincipal) {
      const proximo = await Endereco.findOne({
        where: { id_usuario: idUsuario },
        order: [['id_endereco', 'ASC']],
        transaction,
      });
      if (proximo) await proximo.update({ principal: true }, { transaction });
    }
  });

  logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço removido');
}
