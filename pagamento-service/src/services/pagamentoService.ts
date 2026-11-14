import { Op, UniqueConstraintError } from 'sequelize';
import { Pagamento } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import * as vendas from '../clients/vendasClient';
import { obterGateway } from '../gateways';
import { PagamentoExterno } from '../gateways/tipos';
import { TokenPayload } from '../utils/jwt';
import { publicarPagamentoConfirmado } from '../utils/eventos';
import { registrarEvento } from '../utils/metricas';
import { logger } from '../utils/logger';
import { RegistrarPagamento, FiltrosPagamento } from '../validators/pagamentoValidators';

const PERMISSAO_VER_TODOS = 'pedidos:listar-todos';

const centavos = (valor: number | string) => Math.round(Number(valor) * 100);

export function paraResposta(pagamento: Pagamento) {
  return {
    id_pagamento: pagamento.id_pagamento,
    id_pedido: pagamento.id_pedido,
    metodo_pagamento: pagamento.metodo_pagamento,
    valor: Number(pagamento.valor),
    status: pagamento.status,
    data_pagamento: pagamento.data_pagamento,
    url_pagamento: pagamento.url_pagamento,
  };
}

// Confirma o pagamento: avisa o Vendas (fonte da verdade do status), marca como APROVADO e publica o evento.
// Pode ser chamada de novo (webhook repetido): o Vendas aceita repetir PAGO e só a primeira chamada
// consegue "reivindicar" a mudança para APROVADO, então o evento sai uma única vez.
async function confirmar(pagamento: Pagamento, idGateway: string | null = null) {
  const pedido = await vendas.atualizarStatus(pagamento.id_pedido, 'PAGO');

  const [reivindicado] = await Pagamento.update(
    { status: 'APROVADO', data_pagamento: new Date(), id_pagamento_gateway: idGateway },
    { where: { id_pagamento: pagamento.id_pagamento, status: { [Op.ne]: 'APROVADO' } } }
  );
  if (reivindicado === 0) return;

  pagamento.status = 'APROVADO';
  registrarEvento('pagamento_aprovado');

  if (!pedido.cliente) {
    logger.error({ idPedido: pagamento.id_pedido }, 'pedido sem dados do cliente, evento não publicado');
    return;
  }
  await publicarPagamentoConfirmado({
    idPedido: pagamento.id_pedido,
    valor: Number(pagamento.valor),
    metodoPagamento: pagamento.metodo_pagamento,
    cliente: { nome: pedido.cliente.nome, email: pedido.cliente.email },
  });
}

// Visão do operador: inclui o id do pagamento no gateway (para reembolsar). Nunca expõe o link de pagamento.
function paraRespostaOperador(pagamento: Pagamento) {
  return {
    id_pagamento: pagamento.id_pagamento,
    id_pedido: pagamento.id_pedido,
    metodo_pagamento: pagamento.metodo_pagamento,
    valor: Number(pagamento.valor),
    status: pagamento.status,
    data_pagamento: pagamento.data_pagamento,
    id_pagamento_gateway: pagamento.id_pagamento_gateway,
  };
}

// A rota exige a permissão pedidos:listar-todos (ver pagamentoRoutes).
export async function listarPagamentos(filtros: FiltrosPagamento) {
  const { rows, count } = await Pagamento.findAndCountAll({
    where: filtros.status ? { status: filtros.status } : {},
    order: [['id_pagamento', 'DESC']],
    limit: filtros.limite,
    offset: (filtros.pagina - 1) * filtros.limite,
  });
  return { dados: rows.map(paraRespostaOperador), pagina: filtros.pagina, limite: filtros.limite, total: count };
}

export async function registrarPagamento(usuario: TokenPayload, dados: RegistrarPagamento) {
  const pedido = await vendas.buscarPedido(dados.idPedido);
  if (!pedido) throw new ErroHttp(404, 'Pedido não existe');
  if (pedido.cliente?.id_usuario !== usuario.id_usuario) {
    throw new ErroHttp(403, 'Sem permissão para pagar este pedido');
  }
  if (pedido.status !== 'AGUARDANDO_PAGAMENTO') {
    throw new ErroHttp(409, `O pedido não está aguardando pagamento (status: ${pedido.status})`);
  }
  if (centavos(dados.valor) !== centavos(pedido.valor_total)) {
    throw new ErroHttp(422, 'Valor não confere com o pedido');
  }

  let pagamento = await Pagamento.findOne({ where: { id_pedido: dados.idPedido } });
  if (pagamento?.status === 'APROVADO') throw new ErroHttp(409, 'Este pedido já foi pago');
  // Já existe um link de pagamento em aberto: devolve o mesmo, em vez de criar outro e arriscar pagar duas vezes.
  if (pagamento?.status === 'PENDENTE' && pagamento.url_pagamento) return paraResposta(pagamento);

  const gateway = obterGateway();

  try {
    if (!pagamento) {
      pagamento = await Pagamento.create({
        id_pedido: dados.idPedido,
        id_usuario: usuario.id_usuario,
        metodo_pagamento: dados.metodoPagamento,
        valor: dados.valor,
        status: 'PENDENTE',
      });
    } else {
      await pagamento.update({
        metodo_pagamento: dados.metodoPagamento,
        valor: dados.valor,
        status: 'PENDENTE',
        id_externo: null,
        url_pagamento: null,
      });
    }
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe um pagamento em andamento para este pedido');
    }
    throw err;
  }

  const cobranca = await gateway.iniciar({
    idPedido: dados.idPedido,
    valor: dados.valor,
    emailCliente: pedido.cliente.email,
    valorFrete: Number(pedido.valor_frete),
    expiraEm: pedido.expira_em,
    itens: pedido.itens.map((i) => ({
      id: String(i.id_produto ?? i.nome_produto),
      titulo: i.nome_produto,
      quantidade: i.quantidade,
      precoUnitario: Number(i.preco_unitario),
    })),
  });
  await pagamento.update({ id_externo: cobranca.idExterno, url_pagamento: cobranca.urlPagamento });

  if (cobranca.aprovadoNaHora) await confirmar(pagamento);
  return paraResposta(pagamento);
}

export async function buscarPagamento(usuario: TokenPayload, idPedido: number) {
  const pagamento = await Pagamento.findOne({ where: { id_pedido: idPedido } });
  if (!pagamento) throw new ErroHttp(404, 'Nenhum pagamento para esse pedido');

  const dono = pagamento.id_usuario === usuario.id_usuario;
  if (!dono && !usuario.permissoes.includes(PERMISSAO_VER_TODOS)) {
    throw new ErroHttp(403, 'Sem permissão para acessar este pagamento');
  }
  return paraResposta(pagamento);
}

function ignorar(motivo: string, extra: object = {}) {
  registrarEvento('webhook_ignorado');
  logger.warn({ motivo, ...extra }, 'notificação de pagamento ignorada');
}

const FALHAS_DO_GATEWAY = ['rejected', 'cancelled'];

// Nunca sobrescreve um pagamento já APROVADO (a troca é condicional).
async function marcarParaReembolso(pagamento: Pagamento, idGateway: string | null) {
  const [alterados] = await Pagamento.update(
    { status: 'REEMBOLSAR', id_pagamento_gateway: idGateway },
    { where: { id_pagamento: pagamento.id_pagamento, status: { [Op.ne]: 'APROVADO' } } }
  );
  if (alterados > 0) {
    pagamento.status = 'REEMBOLSAR';
    registrarEvento('pagamento_a_reembolsar');
  }
}

// Regra única de decisão, usada pelo webhook e pela sincronização: dado o que o gateway diz sobre um pagamento,
// confirma, recusa ou não faz nada.
async function aplicarResultado(pagamento: Pagamento, info: PagamentoExterno) {
  const idPedido = pagamento.id_pedido;

  if (info.status === 'approved') {
    if (centavos(info.valor) !== centavos(pagamento.valor)) {
      registrarEvento('pagamento_valor_divergente');
      logger.error({ idPedido, pago: info.valor, esperado: Number(pagamento.valor) }, 'valor pago diferente do pedido');
      return;
    }
    try {
      await confirmar(pagamento, info.id || null);
    } catch (err) {
      // O gateway aprovou, mas o Vendas não aceita (ex.: pedido cancelado): repetir não adianta. O pagamento fica
      // marcado como REEMBOLSAR, com o id do gateway, para o operador devolver o dinheiro (o reembolso é manual).
      if (err instanceof ErroHttp && (err.status === 404 || err.status === 409)) {
        await marcarParaReembolso(pagamento, info.id || null);
        registrarEvento('pagamento_pedido_nao_pagavel');
        logger.error({ idPedido, motivo: err.message }, 'pagamento aprovado para pedido que não aceita pagamento (reembolsar)');
        return;
      }
      throw err;
    }
    return;
  }

  if (FALHAS_DO_GATEWAY.includes(info.status) && pagamento.status === 'PENDENTE') {
    await pagamento.update({ status: 'RECUSADO' });
    registrarEvento('pagamento_recusado');
  }
}

// Chamado pelo webhook. Nada do corpo do webhook é confiável: o pagamento é sempre consultado no gateway.
export async function processarNotificacao(idPagamentoExterno: string) {
  const info = await obterGateway().consultarPagamento(idPagamentoExterno);
  if (!info || !info.externalReference) return ignorar('pagamento desconhecido no gateway', { idPagamentoExterno });

  const idPedido = Number(info.externalReference);
  if (!Number.isInteger(idPedido)) return ignorar('referência externa inválida', { idPagamentoExterno });

  const pagamento = await Pagamento.findOne({ where: { id_pedido: idPedido } });
  if (!pagamento) return ignorar('pedido sem pagamento registrado', { idPedido });

  await aplicarResultado(pagamento, info);
}

// Plano B do webhook (perdido, atrasado ou sem URL pública, como em ambiente local): o dono do pedido (ou quem
// tem pedidos:listar-todos) pede para consultar o gateway agora. Usa a mesma regra de decisão do webhook.
export async function sincronizarPagamento(usuario: TokenPayload, idPedido: number) {
  const pagamento = await Pagamento.findOne({ where: { id_pedido: idPedido } });
  if (!pagamento) throw new ErroHttp(404, 'Nenhum pagamento para esse pedido');

  const dono = pagamento.id_usuario === usuario.id_usuario;
  if (!dono && !usuario.permissoes.includes(PERMISSAO_VER_TODOS)) {
    throw new ErroHttp(403, 'Sem permissão para acessar este pagamento');
  }
  if (pagamento.status === 'APROVADO') return paraResposta(pagamento);

  const encontrados = await obterGateway().buscarPagamentosPorReferencia(String(idPedido));
  const referencia = encontrados.filter((p) => p.externalReference === String(idPedido));

  const aprovado = referencia.find((p) => p.status === 'approved');
  if (aprovado) {
    await aplicarResultado(pagamento, aprovado);
  } else if (referencia.length > 0 && referencia.every((p) => FALHAS_DO_GATEWAY.includes(p.status))) {
    await aplicarResultado(pagamento, referencia[0]);
  }
  return paraResposta(pagamento);
}
