import { STATUS_PEDIDO } from '../models/statusPedido';
import * as painelRepository from '../repositories/painelRepository';

const DIA_MS = 24 * 60 * 60 * 1000;

const dia = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : String(valor)).slice(0, 10);

// RF46 e RF47: métricas do painel administrativo (contagem de pedidos e receita). Usuários e produtos
// são dados de outros serviços e saem das rotas de resumo deles (ADR-012).
export async function resumoDoPainel(dias: number) {
  const porStatusLinhas = await painelRepository.contarPorStatus();

  const pedidosPorStatus = Object.fromEntries(STATUS_PEDIDO.map((s) => [s, 0])) as Record<string, number>;
  for (const linha of porStatusLinhas) pedidosPorStatus[linha.status] = Number(linha.total);

  const receitaPorDia = await painelRepository.receitaPorDia(new Date(Date.now() - dias * DIA_MS));
  const receitaTotal = await painelRepository.somarReceita();
  const ultimas24h = await painelRepository.contarDesde(new Date(Date.now() - DIA_MS));

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
  const linhas = await painelRepository.maisVendidos(limite);

  return linhas.map((l) => ({
    id_produto: l.id_produto,
    nome_produto: l.nome_produto,
    quantidade_vendida: Number(l.quantidade),
    receita: Number(l.receita),
  }));
}
