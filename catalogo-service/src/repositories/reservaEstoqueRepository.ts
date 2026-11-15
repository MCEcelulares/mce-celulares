import { UniqueConstraintError } from 'sequelize';
import { ReservaEstoque } from '../models';
import { statusReserva } from '../config/catalogo';
import { RegistroDuplicadoError } from './erros';
import { Transacao } from './transacao';

export interface ItemReservado {
  id_produto: number;
  quantidade: number;
}

export function buscarPorPedido(idPedido: number, transacao?: Transacao) {
  return ReservaEstoque.findAll({
    where: { id_pedido: idPedido },
    ...(transacao ? { transaction: transacao } : {}),
  });
}

export function buscarPorPedidoTravando(idPedido: number, transacao: Transacao) {
  return ReservaEstoque.findAll({
    where: { id_pedido: idPedido },
    transaction: transacao,
    lock: transacao.LOCK.UPDATE,
  });
}

export async function criarDoPedido(idPedido: number, itens: ItemReservado[], transacao: Transacao) {
  try {
    return await ReservaEstoque.bulkCreate(
      itens.map((i) => ({ id_pedido: idPedido, id_produto: i.id_produto, quantidade: i.quantidade })),
      { transaction: transacao }
    );
  } catch (err) {
    throw err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
  }
}

export function marcarDevolvida(reserva: ReservaEstoque, transacao: Transacao) {
  return reserva.update({ status: statusReserva.devolvida, atualizado_em: new Date() }, { transaction: transacao });
}
