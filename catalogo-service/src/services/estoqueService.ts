import { Op, UniqueConstraintError, literal } from 'sequelize';
import { Produto, ReservaEstoque } from '../models';
import { sequelize } from '../config/database';
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
    const resultado = await sequelize.transaction(async (transaction) => {
      // 1) Trava as linhas dos produtos em ordem fixa: serializa reservas concorrentes dos mesmos itens
      //    sem deadlock e sem gap lock (travar "reservas que ainda não existem" causa deadlock no InnoDB).
      const produtos = await Produto.findAll({
        where: { id_produto: itens.map((i) => i.id_produto) },
        order: [['id_produto', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // 2) Só depois lê as reservas do pedido: já enxerga o que a transação concorrente acabou de gravar.
      const existentes = await ReservaEstoque.findAll({ where: { id_pedido: idPedido }, transaction });
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
        const [alterados] = await Produto.update(
          { estoque: literal(`estoque - ${item.quantidade}`) },
          { where: { id_produto: item.id_produto, ativo: true, estoque: { [Op.gte]: item.quantidade } }, transaction }
        );
        if (alterados === 0) {
          const atual = await Produto.findByPk(item.id_produto, { transaction });
          faltas.push({ id_produto: item.id_produto, solicitado: item.quantidade, disponivel: atual?.estoque ?? 0 });
        }
      }
      if (faltas.length > 0) {
        throw new ErroHttp(409, 'Estoque insuficiente', faltas);
      }

      const reservas = await ReservaEstoque.bulkCreate(
        itens.map((i) => ({ id_pedido: idPedido, id_produto: i.id_produto, quantidade: i.quantidade })),
        { transaction }
      );
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
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma reserva em andamento para este pedido');
    }
    throw err;
  }
}

// Devolve ao estoque os itens da reserva (pedido cancelado). Idempotente: devolver duas vezes não soma duas vezes.
export async function devolverReserva(idPedido: number) {
  const resultado = await sequelize.transaction(async (transaction) => {
    const previas = await ReservaEstoque.findAll({ where: { id_pedido: idPedido }, transaction });
    if (previas.length === 0) {
      throw new ErroHttp(404, 'Não há reserva de estoque para este pedido');
    }

    // Mesma ordem de travas da reserva (produtos primeiro, depois as reservas) para não gerar deadlock.
    await Produto.findAll({
      where: { id_produto: previas.map((r) => r.id_produto) },
      order: [['id_produto', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const reservas = await ReservaEstoque.findAll({
      where: { id_pedido: idPedido },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const ativas = reservas.filter((r) => r.status === statusReserva.ativa);
    for (const reserva of ativas) {
      await Produto.update(
        { estoque: literal(`estoque + ${reserva.quantidade}`) },
        { where: { id_produto: reserva.id_produto }, transaction }
      );
      await reserva.update({ status: statusReserva.devolvida, atualizado_em: new Date() }, { transaction });
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
  const reservas = await ReservaEstoque.findAll({ where: { id_pedido: idPedido } });
  if (reservas.length === 0) {
    throw new ErroHttp(404, 'Não há reserva de estoque para este pedido');
  }
  return paraResposta(idPedido, reservas);
}
