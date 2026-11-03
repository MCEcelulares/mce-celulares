"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reservarEstoque = reservarEstoque;
exports.devolverReserva = devolverReserva;
exports.buscarReserva = buscarReserva;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const catalogo_1 = require("../config/catalogo");
const cacheService_1 = require("./cacheService");
function paraResposta(idPedido, reservas) {
    const ativa = reservas.every((r) => r.status === catalogo_1.statusReserva.ativa);
    return {
        id_pedido: idPedido,
        status: ativa ? catalogo_1.statusReserva.ativa : catalogo_1.statusReserva.devolvida,
        itens: reservas
            .map((r) => ({ id_produto: r.id_produto, quantidade: r.quantidade, status: r.status }))
            .sort((a, b) => a.id_produto - b.id_produto),
    };
}
function mesmosItens(reservas, itens) {
    if (reservas.length !== itens.length)
        return false;
    return itens.every((i) => reservas.some((r) => r.id_produto === i.id_produto && r.quantidade === i.quantidade));
}
// Reserva síncrona (chamada pelo Vendas ao criar o pedido). Tudo ou nada: se um item falhar, nada é baixado.
// Idempotente por pedido: repetir a mesma reserva (ex.: retry do Vendas após timeout) não baixa o estoque duas vezes.
async function reservarEstoque(dados) {
    const { id_pedido: idPedido } = dados;
    const itens = [...dados.itens].sort((a, b) => a.id_produto - b.id_produto); // ordem fixa evita deadlock
    try {
        const resultado = await database_1.sequelize.transaction(async (transaction) => {
            // 1) Trava as linhas dos produtos em ordem fixa: serializa reservas concorrentes dos mesmos itens
            //    sem deadlock e sem gap lock (travar "reservas que ainda não existem" causa deadlock no InnoDB).
            const produtos = await models_1.Produto.findAll({
                where: { id_produto: itens.map((i) => i.id_produto) },
                order: [['id_produto', 'ASC']],
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            // 2) Só depois lê as reservas do pedido: já enxerga o que a transação concorrente acabou de gravar.
            const existentes = await models_1.ReservaEstoque.findAll({ where: { id_pedido: idPedido }, transaction });
            if (existentes.length > 0) {
                if (existentes.some((r) => r.status !== catalogo_1.statusReserva.ativa)) {
                    throw new errorHandler_1.ErroHttp(409, 'A reserva deste pedido já foi devolvida');
                }
                if (!mesmosItens(existentes, itens)) {
                    throw new errorHandler_1.ErroHttp(409, 'Já existe uma reserva diferente para este pedido');
                }
                return { criada: false, reservas: existentes };
            }
            const porId = new Map(produtos.map((p) => [p.id_produto, p]));
            const inexistentes = itens.filter((i) => !porId.has(i.id_produto)).map((i) => i.id_produto);
            if (inexistentes.length > 0) {
                throw new errorHandler_1.ErroHttp(404, `Produto(s) não existe(m): ${inexistentes.join(', ')}`);
            }
            const inativos = itens.filter((i) => !porId.get(i.id_produto).ativo).map((i) => i.id_produto);
            if (inativos.length > 0) {
                throw new errorHandler_1.ErroHttp(409, `Produto(s) indisponível(is): ${inativos.join(', ')}`);
            }
            const faltas = [];
            for (const item of itens) {
                // Baixa atômica e condicional: só desconta se ainda houver estoque (sem ler-e-depois-escrever).
                const [alterados] = await models_1.Produto.update({ estoque: (0, sequelize_1.literal)(`estoque - ${item.quantidade}`) }, { where: { id_produto: item.id_produto, ativo: true, estoque: { [sequelize_1.Op.gte]: item.quantidade } }, transaction });
                if (alterados === 0) {
                    const atual = await models_1.Produto.findByPk(item.id_produto, { transaction });
                    faltas.push({ id_produto: item.id_produto, solicitado: item.quantidade, disponivel: atual?.estoque ?? 0 });
                }
            }
            if (faltas.length > 0) {
                throw new errorHandler_1.ErroHttp(409, 'Estoque insuficiente', faltas);
            }
            const reservas = await models_1.ReservaEstoque.bulkCreate(itens.map((i) => ({ id_pedido: idPedido, id_produto: i.id_produto, quantidade: i.quantidade })), { transaction });
            return { criada: true, reservas };
        });
        if (resultado.criada) {
            await (0, cacheService_1.invalidarCatalogo)();
            (0, metricas_1.registrarEvento)('reserva_criada');
            logger_1.logger.info({ id_pedido: idPedido, itens: itens.length }, 'estoque reservado');
        }
        else {
            logger_1.logger.info({ id_pedido: idPedido }, 'reserva repetida: nada a fazer');
        }
        return { criada: resultado.criada, reserva: paraResposta(idPedido, resultado.reservas) };
    }
    catch (err) {
        if (err instanceof errorHandler_1.ErroHttp && err.message === 'Estoque insuficiente') {
            (0, metricas_1.registrarEvento)('reserva_estoque_insuficiente');
        }
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma reserva em andamento para este pedido');
        }
        throw err;
    }
}
// Devolve ao estoque os itens da reserva (pedido cancelado). Idempotente: devolver duas vezes não soma duas vezes.
async function devolverReserva(idPedido) {
    const resultado = await database_1.sequelize.transaction(async (transaction) => {
        const previas = await models_1.ReservaEstoque.findAll({ where: { id_pedido: idPedido }, transaction });
        if (previas.length === 0) {
            throw new errorHandler_1.ErroHttp(404, 'Não há reserva de estoque para este pedido');
        }
        // Mesma ordem de travas da reserva (produtos primeiro, depois as reservas) para não gerar deadlock.
        await models_1.Produto.findAll({
            where: { id_produto: previas.map((r) => r.id_produto) },
            order: [['id_produto', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const reservas = await models_1.ReservaEstoque.findAll({
            where: { id_pedido: idPedido },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const ativas = reservas.filter((r) => r.status === catalogo_1.statusReserva.ativa);
        for (const reserva of ativas) {
            await models_1.Produto.update({ estoque: (0, sequelize_1.literal)(`estoque + ${reserva.quantidade}`) }, { where: { id_produto: reserva.id_produto }, transaction });
            await reserva.update({ status: catalogo_1.statusReserva.devolvida, atualizado_em: new Date() }, { transaction });
        }
        return { devolvidos: ativas.length, reservas };
    });
    if (resultado.devolvidos > 0) {
        await (0, cacheService_1.invalidarCatalogo)();
        (0, metricas_1.registrarEvento)('reserva_devolvida');
        logger_1.logger.info({ id_pedido: idPedido, itens: resultado.devolvidos }, 'reserva devolvida ao estoque');
    }
    return paraResposta(idPedido, resultado.reservas);
}
async function buscarReserva(idPedido) {
    const reservas = await models_1.ReservaEstoque.findAll({ where: { id_pedido: idPedido } });
    if (reservas.length === 0) {
        throw new errorHandler_1.ErroHttp(404, 'Não há reserva de estoque para este pedido');
    }
    return paraResposta(idPedido, reservas);
}
