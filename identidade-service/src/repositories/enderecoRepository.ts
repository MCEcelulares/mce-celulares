import { Endereco } from '../models';
import { CriarEnderecoInput, AtualizarEnderecoInput } from '../validators/enderecoValidators';
import { Transacao } from './transacao';

export type NovoEndereco = CriarEnderecoInput & { id_usuario: number; principal: boolean };

export type CamposEndereco = AtualizarEnderecoInput;

export function listarDoUsuario(idUsuario: number) {
  return Endereco.findAll({
    where: { id_usuario: idUsuario },
    order: [['principal', 'DESC'], ['id_endereco', 'ASC']],
  });
}

export function buscar(idUsuario: number, idEndereco: number) {
  return Endereco.findOne({ where: { id_endereco: idEndereco, id_usuario: idUsuario } });
}

export function contarDoUsuario(idUsuario: number, transacao: Transacao) {
  return Endereco.count({ where: { id_usuario: idUsuario }, transaction: transacao });
}

export function desmarcarPrincipais(idUsuario: number, transacao: Transacao) {
  return Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction: transacao });
}

export function criar(dados: NovoEndereco, transacao: Transacao) {
  return Endereco.create(dados, { transaction: transacao });
}

export function atualizar(endereco: Endereco, campos: CamposEndereco, transacao: Transacao) {
  return endereco.update(campos, { transaction: transacao });
}

export function remover(endereco: Endereco, transacao: Transacao) {
  return endereco.destroy({ transaction: transacao });
}

export function buscarMaisAntigo(idUsuario: number, transacao: Transacao) {
  return Endereco.findOne({
    where: { id_usuario: idUsuario },
    order: [['id_endereco', 'ASC']],
    transaction: transacao,
  });
}
