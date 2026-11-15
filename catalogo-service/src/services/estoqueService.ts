import type { ReservaEstoque } from '../models';
import * as produtoRepository from '../repositories/produtoRepository';
import * as reservaEstoqueRepository from '../repositories/reservaEstoqueRepository';
import { RegistroDuplicadoError } from '../repositories/erros';
import { comTransacao } from '../repositories/transacao';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { statusReserva } from '../config/catalogo';
import { invalidarCatalogo } from './cacheService';
import { ReservarEstoqueInput } from '../validators/estoqueValidators';

function paraResposta(idPedido: number, reservas: ReservaEstoque[]) {
  const ativa = reservas.every((r) => r.status === statusReserva.ativa);
  return {
    id_pedido: idPedido,
    status: ativa ? statusReserva.ativa : statusReserva.devolvida,
    itens: reservas
      .map((r) => ({ id_produto: r.id_produto, quantidade: r.quantidade, status: r.status }))
      .sort((a, b) => a.id_produto - b.id_produto),
  };
}

function mesmosItens(reservas: ReservaEstoque[], itens: ReservarEstoqueInput['itens']) {
  if (reservas.length !== itens.length) return false;
  return itens.every((i) => reservas.some((r) => r.id_produto === i.id_produto && r.quantidade === i.quantidade));
}

// Reserva síncrona (chamada pelo Vendas ao criar o pedido). Tudo ou nada: se um item falhar, nada é baixado.
// Idempotente por pedido: repetir a mesma reserva (ex.: retry do Vendas após timeout) não baixa o estoque duas vezes.
export async function reservarEstoque(dados: ReservarEstoqueInput) {
  const { id_pedido: idPedido } = dados;
  const itens = [...dados.itens].sort((a, b) => a.id_produto - b.id_produto); // ordem fixa evita deadlock

  try {
    const resultado = await comTransacao(async (transacao) => {
      // 1) Trava as linhas dos produtos em ordem fixa: serializa reservas concorrentes dos mesmos itens
      //    sem deadlock e sem gap lock (travar "reservas que ainda não existem" causa deadlock no InnoDB).
      const produtos = await produtoRepository.travarPorIds(
        itens.map((i) => i.id_produto),
        transacao
      );

      // 2) Só depois lê as reservas do pedido: já enxerga o que a transação concorrente acabou de gravar.
      const existentes = await reservaEstoqueRepository.buscarPorPedido(idPedido, transacao);
      if (existentes.length > 0) {
        if (existentes.some((r) => r.status !== statusReserva.ativa)) {
          throw new ErroHttp(409, 'A reserva deste pedido já foi devolvida');
        }
        if (!mesmosItens(existentes, itens)) {
          throw new ErroHttp(409, 'Já existe uma reserva diferente para este pedido');
        }
        return { criada: false, reservas: existentes };
      }

      const porId = new Map(produtos.map((p) => [p.id_produto, p]));

      const inexistentes = itens.filter((i) => !porId.has(i.id_produto)).map((i) => i.id_produto);
      if (inexistentes.length > 0) {
        throw new ErroHttp(404, `Produto(s) não existe(m): ${inexistentes.join(', ')}`);
      }

      const inativos = itens.filter((i) => !porId.get(i.id_produto)!.ativo).map((i) => i.id_produto);
      if (inativos.length > 0) {
        throw new ErroHttp(409, `Produto(s) indisponível(is): ${inativos.join(', ')}`);
      }

      const faltas: { id_produto: number; solicitado: number; disponivel: number }[] = [];
      for (const item of itens) {
        // Baixa atômica e condicional: só desconta se ainda houver estoque (sem ler-e-depois-escrever).
        const baixou = await produtoRepository.baixarSeHouver(item.id_produto, item.quantidade, transacao);
        if (!baixou) {
          const atual = await produtoRepository.buscarPorId(item.id_produto, transacao);
          faltas.push({ id_produto: item.id_produto, solicitado: item.quantidade, disponivel: atual?.estoque ?? 0 });
        }
      }
      if (faltas.length > 0) {
        throw new ErroHttp(409, 'Estoque insuficiente', faltas);
      }

      const reservas = await reservaEstoqueRepository.criarDoPedido(idPedido, itens, transacao);
      return { criada: true, reservas };
    });

    if (resultado.criada) {
      await invalidarCatalogo();
      registrarEvento('reserva_criada');
      logger.info({ id_pedido: idPedido, itens: itens.length }, 'estoque reservado');
    } else {
      logger.info({ id_pedido: idPedido }, 'reserva repetida: nada a fazer');
    }
    return { criada: resultado.criada, reserva: paraResposta(idPedido, resultado.reservas) };
  } catch (err) {
    if (err instanceof ErroHttp && err.message === 'Estoque insuficiente') {
      registrarEvento('reserva_estoque_insuficiente');
    }
    if (err instanceof RegistroDuplicadoError) {
      throw new ErroHttp(409, 'Já existe uma reserva em andamento para este pedido');
    }
    throw err;
  }
}

// Devolve ao estoque os itens da reserva (pedido cancelado). Idempotente: devolver duas vezes não soma duas vezes.
export async function devolverReserva(idPedido: number) {
  const resultado = await comTransacao(async (transacao) => {
    const previas = await reservaEstoqueRepository.buscarPorPedido(idPedido, transacao);
    if (previas.length === 0) {
      throw new ErroHttp(404, 'Não há reserva de estoque para este pedido');
    }

    // Mesma ordem de travas da reserva (produtos primeiro, depois as reservas) para não gerar deadlock.
    await produtoRepository.travarPorIds(
      previas.map((r) => r.id_produto),
      transacao
    );
    const reservas = await reservaEstoqueRepository.buscarPorPedidoTravando(idPedido, transacao);

    const ativas = reservas.filter((r) => r.status === statusReserva.ativa);
    for (const reserva of ativas) {
      await produtoRepository.devolverQuantidade(reserva.id_produto, reserva.quantidade, transacao);
      await reservaEstoqueRepository.marcarDevolvida(reserva, transacao);
    }
    return { devolvidos: ativas.length, reservas };
  });

  if (resultado.devolvidos > 0) {
    await invalidarCatalogo();
    registrarEvento('reserva_devolvida');
    logger.info({ id_pedido: idPedido, itens: resultado.devolvidos }, 'reserva devolvida ao estoque');
  }
  return paraResposta(idPedido, resultado.reservas);
}

export async function buscarReserva(idPedido: number) {
  const reservas = await reservaEstoqueRepository.buscarPorPedido(idPedido);
  if (reservas.length === 0) {
    throw new ErroHttp(404, 'Não há reserva de estoque para este pedido');
  }
  return paraResposta(idPedido, reservas);
}
