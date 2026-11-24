import { UniqueConstraintError } from 'sequelize';
import { Cargo, CargoPermissao, Permissao, UsuarioCargo } from '../models';
import { RegistroDuplicadoError } from './erros';
import { Transacao } from './transacao';

const incluirPermissoes = [
  { model: Permissao, as: 'permissoes', attributes: ['nome'], through: { attributes: [] } },
];

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function listarComPermissoes() {
  return Cargo.findAll({ include: incluirPermissoes, order: [['id_cargo', 'ASC']] });
}

export function buscarPorIdComPermissoes(id: number) {
  return Cargo.findByPk(id, { include: incluirPermissoes });
}

export function buscarPorNome(nome: string, transacao?: Transacao) {
  return Cargo.findOne({ where: { nome }, ...(transacao ? { transaction: transacao } : {}) });
}

export function buscarPorNomes(nomes: string[]) {
  return Cargo.findAll({ where: { nome: nomes } });
}

export function listarComPermissao(idPermissao: number) {
  return Cargo.findAll({
    include: [{ model: Permissao, as: 'permissoes', where: { id_permissao: idPermissao }, required: true }],
  });
}

export async function criar(nome: string, transacao: Transacao) {
  try {
    return await Cargo.create({ nome }, { transaction: transacao });
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function renomear(cargo: Cargo, nome: string) {
  try {
    return await cargo.update({ nome });
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function contarUsuarios(idCargo: number) {
  return UsuarioCargo.count({ where: { id_cargo: idCargo } });
}

export function excluir(cargo: Cargo, transacao: Transacao) {
  return cargo.destroy({ transaction: transacao });
}

export function vincularPermissoes(idCargo: number, idsPermissao: number[], transacao: Transacao) {
  return CargoPermissao.bulkCreate(
    idsPermissao.map((id_permissao) => ({ id_cargo: idCargo, id_permissao })),
    { transaction: transacao }
  );
}

export function removerVinculosDoCargo(idCargo: number, transacao: Transacao) {
  return CargoPermissao.destroy({ where: { id_cargo: idCargo }, transaction: transacao });
}

export function removerVinculosDaPermissao(idPermissao: number, transacao: Transacao) {
  return CargoPermissao.destroy({ where: { id_permissao: idPermissao }, transaction: transacao });
}
