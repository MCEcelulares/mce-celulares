import { UniqueConstraintError } from 'sequelize';
import { CargoPermissao, Permissao } from '../models';
import { RegistroDuplicadoError } from './erros';
import { Transacao } from './transacao';

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function listar() {
  return Permissao.findAll({ order: [['nome', 'ASC']] });
}

export function buscarPorId(id: number) {
  return Permissao.findByPk(id);
}

export function buscarPorNomes(nomes: string[]) {
  return Permissao.findAll({ where: { nome: nomes } });
}

export async function criar(nome: string, transacao: Transacao) {
  try {
    return await Permissao.create({ nome }, { transaction: transacao });
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function renomear(permissao: Permissao, nome: string) {
  try {
    return await permissao.update({ nome });
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function excluir(permissao: Permissao, transacao: Transacao) {
  return permissao.destroy({ transaction: transacao });
}

// A permissão nova nasce já ligada a um cargo (o administrador).
export function vincularAoCargo(idCargo: number, idPermissao: number, transacao: Transacao) {
  return CargoPermissao.create({ id_cargo: idCargo, id_permissao: idPermissao }, { transaction: transacao });
}
