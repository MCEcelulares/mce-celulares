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

interface ItemParaDevolver {
  id_produto: number | null;
  quantidade: number;
}

// Devolução é "melhor esforço": uma falha é registrada (para conciliar à mão) e nunca repete a devolução
// dos itens que já voltaram, o que criaria estoque fantasma.
async function devolverEstoque(itens: ItemParaDevolver[]) {
  for (const item of itens) {
    if (item.id_produto === null) continue;
    try {
      await catalogo.reporEstoque(item.id_produto, item.quantidade);
    } catch (err) {
      registrarEvento('estoque_nao_devolvido');
      logger.error({ err, id_produto: item.id_produto, quantidade: item.quantidade }, 'estoque não devolvido ao Catálogo');
    }
  }
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

  const reservados: ItemParaDevolver[] = [];
  let idPedido: number;
  try {
    for (const linha of linhas) {
      const resultado = await catalogo.baixarEstoque(linha.id_produto, linha.quantidade);
      if (resultado !== 'ok') {
        throw new ErroHttp(409, `Estoque insuficiente para "${linha.nome}"`);
      }
      reservados.push({ id_produto: linha.id_produto, quantidade: linha.quantidade });
    }

    idPedido = await sequelize.transaction(async (transaction) => {
      const pedido = await Pedido.create(
        { valor_total: valorTotal, valor_frete: valorFrete, status: 'AGUARDANDO_PAGAMENTO' },
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
      await carrinho.update({ ativo: false }, { transaction });
      return pedido.id_pedido;
    });
  } catch (err) {
    await devolverEstoque(reservados);
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

export async function buscarPedido(usuario: TokenPayload, id: number) {
  const pedido = await Pedido.findByPk(id, { include: incluirDetalhe, order: ordemItens });
  if (!pedido) throw new ErroHttp(404, 'Pedido não existe');

  const dono = pedido.cliente?.id_usuario === usuario.id_usuario;
  if (!dono && !usuario.permissoes.includes(PERMISSAO_VER_TODOS)) {
    throw new ErroHttp(403, 'Sem permissão para acessar este pedido');
  }
  return paraResposta(pedido);
}

export type AutorDaMudanca = { servico: true } | { servico: false; usuario: TokenPayload };

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

  await pedido.update({ status: novoStatus });

  if (novoStatus === 'CANCELADO') {
    registrarEvento('pedido_cancelado');
    await devolverEstoque(pedido.itens ?? []);
  }
  return paraResposta(pedido);
}
