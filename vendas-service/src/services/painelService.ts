import { col, fn, literal, Op } from 'sequelize';
import { ItemPedido, Pedido } from '../models';
import { STATUS_PEDIDO } from '../models/statusPedido';

// Pedidos que já geraram receita (pagos, em entrega ou entregues).
const STATUS_COM_RECEITA = ['PAGO', 'ENVIADO', 'ENTREGUE'];

const DIA_MS = 24 * 60 * 60 * 1000;

const dia = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : String(valor)).slice(0, 10);

// RF46 e RF47: métricas do painel administrativo (contagem de pedidos e receita). Usuários e produtos
// são dados de outros serviços e saem das rotas de resumo deles (ADR-012).
export async function resumoDoPainel(dias: number) {
  const ativos = { ativo: true };
  const comReceita = { ...ativos, status: { [Op.in]: STATUS_COM_RECEITA } };

  const porStatusLinhas = (await Pedido.findAll({
    attributes: ['status', [fn('COUNT', col('id_pedido')), 'total']],
    where: ativos,
    group: ['status'],
    raw: true,
  })) as unknown as { status: string; total: string }[];

  const pedidosPorStatus = Object.fromEntries(STATUS_PEDIDO.map((s) => [s, 0])) as Record<string, number>;
  for (const linha of porStatusLinhas) pedidosPorStatus[linha.status] = Number(linha.total);

  const receitaPorDia = (await Pedido.findAll({
    attributes: [
      [fn('DATE', col('data')), 'dia'],
      [fn('SUM', col('valor_total')), 'receita'],
      [fn('COUNT', col('id_pedido')), 'pedidos'],
    ],
    where: { ...comReceita, data: { [Op.gte]: new Date(Date.now() - dias * DIA_MS) } },
    group: [fn('DATE', col('data'))],
    order: [[fn('DATE', col('data')), 'ASC']],
    raw: true,
  })) as unknown as { dia: unknown; receita: string; pedidos: string }[];

  const receitaTotal = (await Pedido.sum('valor_total', { where: comReceita })) ?? 0;
  const ultimas24h = await Pedido.count({ where: { ...ativos, data: { [Op.gte]: new Date(Date.now() - DIA_MS) } } });

  return {
    total_pedidos: Object.values(pedidosPorStatus).reduce((soma, n) => soma + n, 0),
    pedidos_por_status: pedidosPorStatus,
    pedidos_ultimas_24h: ultimas24h,
    receita_total: Number(receitaTotal),
    receita_por_dia: receitaPorDia.map((l) => ({ dia: dia(l.dia), receita: Number(l.receita), pedidos: Number(l.pedidos) })),
  };
}

// RF18: produtos mais vendidos, contando só pedidos que geraram receita.
export async function maisVendidos(limite: number) {
  const linhas = (await ItemPedido.findAll({
    attributes: [
      'id_produto',
      [fn('MAX', col('nome_produto')), 'nome_produto'],
      [fn('SUM', col('quantidade')), 'quantidade'],
      [fn('SUM', literal('`ItemPedido`.`quantidade` * `ItemPedido`.`preco_unitario`')), 'receita'],
    ],
    include: [
      { model: Pedido, attributes: [], required: true, where: { ativo: true, status: { [Op.in]: STATUS_COM_RECEITA } } },
    ],
    group: ['id_produto'],
    order: [[literal('quantidade'), 'DESC']],
    limit: limite,
    raw: true,
  })) as unknown as { id_produto: number | null; nome_produto: string; quantidade: string; receita: string }[];

  return linhas.map((l) => ({
    id_produto: l.id_produto,
    nome_produto: l.nome_produto,
    quantidade_vendida: Number(l.quantidade),
    receita: Number(l.receita),
  }));
}
