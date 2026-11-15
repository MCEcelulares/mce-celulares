import { col, fn, literal, Op } from 'sequelize';
import { ItemPedido, Pedido } from '../models';

// Pedidos que já geraram receita (pagos, em entrega ou entregues). Pedido invisível (ativo=false) nunca conta.
const STATUS_COM_RECEITA = ['PAGO', 'ENVIADO', 'ENTREGUE'];

const ativos = { ativo: true };
const comReceita = { ...ativos, status: { [Op.in]: STATUS_COM_RECEITA } };

export async function contarPorStatus() {
  return (await Pedido.findAll({
    attributes: ['status', [fn('COUNT', col('id_pedido')), 'total']],
    where: ativos,
    group: ['status'],
    raw: true,
  })) as unknown as { status: string; total: string }[];
}

export async function receitaPorDia(desde: Date) {
  return (await Pedido.findAll({
    attributes: [
      [fn('DATE', col('data')), 'dia'],
      [fn('SUM', col('valor_total')), 'receita'],
      [fn('COUNT', col('id_pedido')), 'pedidos'],
    ],
    where: { ...comReceita, data: { [Op.gte]: desde } },
    group: [fn('DATE', col('data'))],
    order: [[fn('DATE', col('data')), 'ASC']],
    raw: true,
  })) as unknown as { dia: unknown; receita: string; pedidos: string }[];
}

export async function somarReceita() {
  return (await Pedido.sum('valor_total', { where: comReceita })) ?? 0;
}

export function contarDesde(desde: Date) {
  return Pedido.count({ where: { ...ativos, data: { [Op.gte]: desde } } });
}

export async function maisVendidos(limite: number) {
  return (await ItemPedido.findAll({
    attributes: [
      'id_produto',
      [fn('MAX', col('nome_produto')), 'nome_produto'],
      [fn('SUM', col('quantidade')), 'quantidade'],
      [fn('SUM', literal('`ItemPedido`.`quantidade` * `ItemPedido`.`preco_unitario`')), 'receita'],
    ],
    include: [{ model: Pedido, attributes: [], required: true, where: comReceita }],
    group: ['id_produto'],
    order: [[literal('quantidade'), 'DESC']],
    limit: limite,
    raw: true,
  })) as unknown as { id_produto: number | null; nome_produto: string; quantidade: string; receita: string }[];
}
