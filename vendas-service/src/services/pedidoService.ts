import { Order } from 'sequelize';
import { sequelize } from '../config/database';
import { EnderecoPedido, ItemPedido, Pedido, UsuarioPedido } from '../models';
import { StatusPedido } from '../models/statusPedido';
import { ErroHttp } from '../middlewares/errorHandler';
import * as catalogo from '../clients/catalogoClient';
import * as identidade from '../clients/identidadeClient';
import { carregarCarrinhoAtivo, centavos } from './carrinhoService';
import { TokenPayload } from '../utils/jwt';
import { publicarPedidoCriado } from '../utils/eventos';
import { registrarEvento } from '../utils/metricas';
import { logger } from '../utils/logger';
import { FiltrosPedido } from '../validators/pedidoValidators';

const PERMISSAO_VER_TODOS = 'pedidos:listar-todos';
const PERMISSAO_ATUALIZAR_STATUS = 'pedidos:atualizar-status';
const PERMISSAO_CANCELAR = 'pedidos:cancelar';

const atributosCliente = ['id_usuario', 'nome', 'email', 'telefone'];

const incluirDetalhe = [
  { model: ItemPedido, as: 'itens' },
  { model: EnderecoPedido, as: 'endereco' },
  { model: UsuarioPedido, as: 'cliente', attributes: atributosCliente },
];
const ordemItens: Order = [[{ model: ItemPedido, as: 'itens' }, 'id_item', 'ASC']];

// Fluxo do pedido (RF33). Repetir o status atual é aceito (o Pagamento pode repetir a chamada).
const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  AGUARDANDO_PAGAMENTO: ['PAGO', 'CANCELADO'],
  PAGO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

// Pedido não pago expira e devolve o estoque (ADR-009). PEDIDO_EXPIRA_MINUTOS=0 desliga.
export const minutosParaExpirar = () => Number(process.env.PEDIDO_EXPIRA_MINUTOS ?? 30);

function expiraEm(pedido: Pedido): string | null {
  const minutos = minutosParaExpirar();
  if (pedido.status !== 'AGUARDANDO_PAGAMENTO' || !(minutos > 0)) return null;
  return new Date(new Date(pedido.data).getTime() + minutos * 60_000).toISOString();
}

function dadosDoCliente(pedido: Pedido) {
  const c = pedido.cliente;
  return c ? { id_usuario: c.id_usuario, nome: c.nome, email: c.email, telefone: c.telefone } : null;
}

// Nunca expõe CPF nem id_envio_externo.
export function paraResposta(pedido: Pedido) {
  const e = pedido.endereco;
  return {
    id_pedido: pedido.id_pedido,
    data: pedido.data,
    status: pedido.status,
    valor_total: Number(pedido.valor_total),
    valor_frete: Number(pedido.valor_frete),
    expira_em: expiraEm(pedido),
    metodo_envio: pedido.metodo_envio,
    prazo_entrega_dias: pedido.prazo_entrega_dias,
    codigo_rastreio: pedido.codigo_rastreio,
    itens: (pedido.itens ?? []).map((i) => ({
      id_item: i.id_item,
      id_produto: i.id_produto,
      nome_produto: i.nome_produto,
      quantidade: i.quantidade,
      preco_unitario: Number(i.preco_unitario),
    })),
    endereco: e
      ? {
          endereco: e.endereco,
          numero: e.numero,
          complemento: e.complemento,
          bairro: e.bairro,
          cidade: e.cidade,
          estado: e.estado,
          cep: e.cep,
        }
      : null,
    cliente: dadosDoCliente(pedido),
  };
}

function resumo(pedido: Pedido) {
  return {
    id_pedido: pedido.id_pedido,
    data: pedido.data,
    status: pedido.status,
    valor_total: Number(pedido.valor_total),
    valor_frete: Number(pedido.valor_frete),
    cliente: dadosDoCliente(pedido),
  };
}

// Devolve ao Catálogo a reserva do pedido (idempotente e repetida em falha de rede, ver catalogoClient).
// Se mesmo assim falhar, o pedido continua cancelado e a falha fica em log e na métrica para conciliação.
async function devolverReservaDoPedido(idPedido: number) {
  try {
    await catalogo.devolverReserva(idPedido);
  } catch (err) {
    registrarEvento('estoque_nao_devolvido');
    logger.error({ err, idPedido }, 'reserva de estoque não devolvida ao Catálogo');
  }
}

// Apaga um pedido que nunca chegou a ficar visível (ativo=false): itens, endereço, cliente e o próprio pedido.
async function descartarPedido(idPedido: number) {
  await sequelize.transaction(async (transaction) => {
    await ItemPedido.destroy({ where: { id_pedido: idPedido }, transaction });
    await EnderecoPedido.destroy({ where: { id_pedido: idPedido }, transaction });
    await UsuarioPedido.destroy({ where: { id_pedido: idPedido }, transaction });
    await Pedido.destroy({ where: { id_pedido: idPedido, ativo: false }, transaction });
  });
}

// Usado quando a criação já falhou: o erro original é o que importa, então uma falha aqui só vira log.
// O pedido fica invisível no banco (ativo=false) para a recuperação de órfãos tratar depois.
async function descartarPedidoSemFalhar(idPedido: number) {
  try {
    await descartarPedido(idPedido);
  } catch (err) {
    logger.error({ err, idPedido }, 'não foi possível apagar o pedido que não chegou a ser criado');
  }
}

// Prazo para considerar "órfão" um pedido que nunca ficou visível (a criação caiu no meio). Vale também com a expiração desligada.
export const minutosParaOrfao = () => Number(process.env.PEDIDO_ORFAO_MINUTOS ?? 10);

// Recupera um pedido invisível antigo: devolve a reserva (se existir) e apaga o pedido. Se a devolução falhar,
// lança o erro e o pedido fica para a próxima rodada (a reserva só é perdida se o pedido for apagado antes).
export async function recuperarPedidoOrfao(id: number): Promise<boolean> {
  const pedido = await Pedido.findByPk(id);
  if (!pedido || pedido.ativo) return false;

  await catalogo.devolverReserva(id);
  await descartarPedido(id);
  registrarEvento('pedido_orfao_recuperado');
  logger.warn({ idPedido: id }, 'pedido órfão recuperado: reserva devolvida e pedido apagado');
  return true;
}

// Traduz a recusa do Catálogo na resposta ao cliente.
function erroDaReserva(resultado: Exclude<catalogo.ResultadoReserva, { tipo: 'ok' }>, nomes: Map<number, string>) {
  if (resultado.tipo === 'sem_estoque') {
    const faltas = resultado.faltas
      .map((f) => `"${nomes.get(f.id_produto) ?? f.id_produto}" (disponível: ${f.disponivel})`)
      .join(', ');
    return new ErroHttp(409, `Estoque insuficiente para ${faltas}`);
  }
  if (resultado.status === 404) return new ErroHttp(422, 'Algum produto do carrinho não está mais disponível');
  return new ErroHttp(409, resultado.mensagem);
}

export async function criarPedido(usuario: TokenPayload, authorization: string, idEndereco: number) {
  const idUsuario = usuario.id_usuario;

  const carrinho = await carregarCarrinhoAtivo(idUsuario);
  if (!carrinho || !carrinho.itens || carrinho.itens.length === 0) {
    throw new ErroHttp(422, 'Carrinho vazio ou não encontrado');
  }

  const perfil = await identidade.buscarUsuario(idUsuario, authorization);
  if (!perfil || !perfil.ativo) throw new ErroHttp(422, 'Usuário inválido');
  if (!perfil.cpf || !perfil.telefone) {
    throw new ErroHttp(422, 'Complete o cadastro (CPF e telefone) para finalizar a compra');
  }

  const endereco = await identidade.buscarEndereco(idUsuario, idEndereco, authorization);
  if (!endereco) throw new ErroHttp(422, 'Endereço inválido');

  // Preço e estoque vêm do Catálogo agora, não do que estava no carrinho.
  const linhas: { id_produto: number; nome: string; preco: number; quantidade: number }[] = [];
  for (const item of carrinho.itens) {
    const produto = await catalogo.buscarProduto(item.id_produto);
    if (!produto) throw new ErroHttp(422, `Produto ${item.id_produto} não está mais disponível`);
    if (produto.estoque < item.quantidade) {
      throw new ErroHttp(409, `Estoque insuficiente para "${produto.nome}" (disponível: ${produto.estoque})`);
    }
    linhas.push({ id_produto: item.id_produto, nome: produto.nome, preco: produto.preco, quantidade: item.quantidade });
  }

  const valorFrete = 0; // frete ainda não é calculado (sem regra definida no projeto)
  const valorTotal = (linhas.reduce((soma, l) => soma + centavos(l.preco) * l.quantidade, 0) + centavos(valorFrete)) / 100;

  // 1) grava o pedido INVISÍVEL (ativo=false): o Catálogo reserva por id de pedido, então ele precisa existir antes.
  const idPedido = await sequelize.transaction(async (transaction) => {
    const pedido = await Pedido.create(
      { valor_total: valorTotal, valor_frete: valorFrete, status: 'AGUARDANDO_PAGAMENTO', ativo: false },
      { transaction }
    );
    await ItemPedido.bulkCreate(
      linhas.map((l) => ({
        id_pedido: pedido.id_pedido,
        id_produto: l.id_produto,
        nome_produto: l.nome.slice(0, 150),
        quantidade: l.quantidade,
        preco_unitario: l.preco,
      })),
      { transaction }
    );
    await EnderecoPedido.create(
      {
        id_pedido: pedido.id_pedido,
        endereco: endereco.endereco,
        numero: endereco.numero,
        complemento: endereco.complemento,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        estado: endereco.estado,
        cep: endereco.cep,
      },
      { transaction }
    );
    await UsuarioPedido.create(
      {
        id_pedido: pedido.id_pedido,
        id_usuario: idUsuario,
        nome: perfil.nome,
        email: perfil.email,
        cpf: perfil.cpf as string,
        telefone: perfil.telefone as string,
      },
      { transaction }
    );
    return pedido.id_pedido;
  });

  // 2) reserva o estoque de todos os itens de uma vez (tudo ou nada). Sem reserva, o pedido invisível é apagado.
  let reserva: catalogo.ResultadoReserva;
  try {
    reserva = await catalogo.reservarEstoque(
      idPedido,
      linhas.map((l) => ({ id_produto: l.id_produto, quantidade: l.quantidade }))
    );
  } catch (err) {
    // Catálogo fora do ar ou resposta inesperada: a reserva pode ou não ter sido feita, então não apagamos o
    // pedido sem antes tentar devolver. Se a devolução falhar, ele fica invisível para a recuperação de órfãos.
    try {
      await catalogo.devolverReserva(idPedido);
      await descartarPedidoSemFalhar(idPedido);
    } catch (erroDevolucao) {
      logger.error({ err: erroDevolucao, idPedido }, 'reserva incerta: pedido invisível mantido para recuperação');
    }
    throw err;
  }
  if (reserva.tipo !== 'ok') {
    await descartarPedidoSemFalhar(idPedido);
    throw erroDaReserva(reserva, new Map(linhas.map((l) => [l.id_produto, l.nome])));
  }

  // 3) torna o pedido visível e encerra o carrinho na mesma transação.
  try {
    await sequelize.transaction(async (transaction) => {
      await Pedido.update({ ativo: true }, { where: { id_pedido: idPedido }, transaction });
      await carrinho.update({ ativo: false }, { transaction });
    });
  } catch (err) {
    try {
      await catalogo.devolverReserva(idPedido);
      await descartarPedidoSemFalhar(idPedido);
    } catch (erroDevolucao) {
      logger.error({ err: erroDevolucao, idPedido }, 'reserva não devolvida: pedido invisível mantido para recuperação');
    }
    throw err;
  }

  registrarEvento('pedido_criado');
  await publicarPedidoCriado({
    idPedido,
    status: 'AGUARDANDO_PAGAMENTO',
    valorTotal,
    cliente: { nome: perfil.nome, email: perfil.email },
  });

  const completo = await Pedido.findByPk(idPedido, { include: incluirDetalhe, order: ordemItens });
  return paraResposta(completo!);
}

export async function listarPedidos(usuario: TokenPayload, filtros: FiltrosPedido) {
  if (filtros.todos && !usuario.permissoes.includes(PERMISSAO_VER_TODOS)) {
    throw new ErroHttp(403, 'Sem permissão para listar todos os pedidos');
  }

  const cliente = {
    model: UsuarioPedido,
    as: 'cliente',
    attributes: atributosCliente,
    ...(filtros.todos ? {} : { where: { id_usuario: usuario.id_usuario }, required: true }),
  };
  const where = { ativo: true, ...(filtros.status && { status: filtros.status }) };

  const { rows, count } = await Pedido.findAndCountAll({
    where,
    include: [cliente],
    order: [['data', 'DESC'], ['id_pedido', 'DESC']],
    limit: filtros.limite,
    offset: (filtros.pagina - 1) * filtros.limite,
  });

  return { dados: rows.map(resumo), pagina: filtros.pagina, limite: filtros.limite, total: count };
}

export type AutorDaMudanca = { servico: true } | { servico: false; usuario: TokenPayload };

export async function buscarPedido(autor: AutorDaMudanca, id: number) {
  const pedido = await Pedido.findByPk(id, { include: incluirDetalhe, order: ordemItens });
  if (!pedido) throw new ErroHttp(404, 'Pedido não existe');

  if (!autor.servico) {
    const dono = pedido.cliente?.id_usuario === autor.usuario.id_usuario;
    if (!dono && !autor.usuario.permissoes.includes(PERMISSAO_VER_TODOS)) {
      throw new ErroHttp(403, 'Sem permissão para acessar este pedido');
    }
  }
  return paraResposta(pedido);
}

export async function atualizarStatus(id: number, novoStatus: StatusPedido, autor: AutorDaMudanca) {
  const pedido = await Pedido.findByPk(id, { include: incluirDetalhe, order: ordemItens });
  if (!pedido) throw new ErroHttp(404, 'Pedido não existe');

  if (!autor.servico) {
    const exigida = novoStatus === 'CANCELADO' ? PERMISSAO_CANCELAR : PERMISSAO_ATUALIZAR_STATUS;
    if (!autor.usuario.permissoes.includes(exigida)) {
      throw new ErroHttp(403, 'Sem permissão para esta ação');
    }
  }

  if (pedido.status === novoStatus) return paraResposta(pedido);
  if (!TRANSICOES[pedido.status].includes(novoStatus)) {
    throw new ErroHttp(409, `Não é possível mudar o pedido de ${pedido.status} para ${novoStatus}`);
  }

  // Troca condicional ao status lido: se outra chamada mudou o pedido no meio (ex.: pagamento x expiração),
  // só uma vence, e só quem vence devolve o estoque.
  const [alterados] = await Pedido.update(
    { status: novoStatus },
    { where: { id_pedido: id, status: pedido.status } }
  );
  if (alterados === 0) throw new ErroHttp(409, 'O status do pedido mudou, tente novamente');
  pedido.status = novoStatus;

  if (novoStatus === 'CANCELADO') {
    registrarEvento('pedido_cancelado');
    await devolverReservaDoPedido(id);
  }
  return paraResposta(pedido);
}

// Cancela um pedido que ficou tempo demais sem pagamento. Só age se ele AINDA estiver aguardando pagamento
// (a troca é condicional), então nunca cancela um pedido pago no meio da corrida.
export async function expirarPedido(id: number): Promise<boolean> {
  const pedido = await Pedido.findByPk(id, { include: incluirDetalhe, order: ordemItens });
  if (!pedido || pedido.status !== 'AGUARDANDO_PAGAMENTO') return false;

  const [alterados] = await Pedido.update(
    { status: 'CANCELADO' },
    { where: { id_pedido: id, status: 'AGUARDANDO_PAGAMENTO' } }
  );
  if (alterados === 0) return false;

  registrarEvento('pedido_expirado');
  logger.info({ idPedido: id }, 'pedido expirado por falta de pagamento');
  await devolverReservaDoPedido(id);
  return true;
}
