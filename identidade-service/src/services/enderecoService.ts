import { Endereco, Usuario } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { CriarEnderecoInput } from '../validators/enderecoValidators';

export async function listarEnderecos(idUsuario: number) {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) {
    throw new ErroHttp(404, 'Usuário não existe');
  }
  return Endereco.findAll({ where: { id_usuario: idUsuario } });
}

export async function criarEndereco(idUsuario: number, dados: CriarEnderecoInput) {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) {
    throw new ErroHttp(404, 'Usuário não existe');
  }

  const totalExistente = await Endereco.count({ where: { id_usuario: idUsuario } });
  const principal = dados.principal ?? totalExistente === 0;

  if (principal) {
    await Endereco.update({ principal: false }, { where: { id_usuario: idUsuario } });
  }

  return Endereco.create({ ...dados, id_usuario: idUsuario, principal });
}

export async function marcarEnderecoPrincipal(idUsuario: number, idEndereco: number) {
  const endereco = await Endereco.findOne({ where: { id_endereco: idEndereco, id_usuario: idUsuario } });
  if (!endereco) {
    throw new ErroHttp(404, 'Endereço não encontrado para esse usuário');
  }

  await Endereco.update({ principal: false }, { where: { id_usuario: idUsuario } });
  endereco.principal = true;
  await endereco.save();

  return endereco;
}
