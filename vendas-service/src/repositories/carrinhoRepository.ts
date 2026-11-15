import { Order, UniqueConstraintError } from 'sequelize';
import { Carrinho, ItemCarrinho } from '../models';
import { RegistroDuplicadoError } from './erros';
import { Transacao } from './transacao';

const incluirItens = [{ model: ItemCarrinho, as: 'itens' }];
const ordemItens: Order = [[{ model: ItemCarrinho, as: 'itens' }, 'id_item_carrinho', 'ASC']];

export interface NovoItem {
  id_carrinho: number;
  id_produto: number;
  preco_unitario: number;
  quantidade: number;
}

export interface CamposItem {
  quantidade: number;
  preco_unitario: number;
}

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function buscarAtivoComItens(idUsuario: number) {
  return Carrinho.findOne({ where: { id_usuario: idUsuario, ativo: true }, include: incluirItens, order: ordemItens });
}

export function criar(idUsuario: number) {
  return Carrinho.create({ id_usuario: idUsuario });
}

export async function criarItem(dados: NovoItem) {
  try {
    return await ItemCarrinho.create(dados);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function atualizarItem(item: ItemCarrinho, campos: CamposItem) {
  try {
    return await item.update(campos);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function removerItem(item: ItemCarrinho) {
  return item.destroy();
}

export function encerrar(carrinho: Carrinho, transacao: Transacao) {
  return carrinho.update({ ativo: false }, { transaction: transacao });
}
