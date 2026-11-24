import { Op, Order } from 'sequelize';
import { EnderecoPedido, ItemPedido, Pedido, UsuarioPedido } from '../models';
import { StatusPedido } from '../models/statusPedido';
import { Transacao } from './transacao';

const atributosCliente = ['id_usuario', 'nome', 'email', 'telefone'];

const incluirDetalhe = [
  { model: ItemPedido, as: 'itens' },
  { model: EnderecoPedido, as: 'endereco' },
  { model: UsuarioPedido, as: 'cliente', attributes: atributosCliente },
];
const ordemItens: Order = [[{ model: ItemPedido, as: 'itens' }, 'id_item', 'ASC']];

export interface ItemDoNovoPedido {
  id_produto: number;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
}

export type EnderecoDoNovoPedido = Pick<
  EnderecoPedido,
  'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'estado' | 'cep'
>;

export interface ClienteDoNovoPedido {
  id_usuario: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
}

export interface NovoPedido {
  valor_total: number;
  valor_frete: number;
  itens: ItemDoNovoPedido[];
  endereco: EnderecoDoNovoPedido;
  cliente: ClienteDoNovoPedido;
}

export interface FiltroListagem {
  idUsuario?: number;
  status?: StatusPedido;
  limite: number;
  pagina: number;
}

export async function gravarInvisivel(dados: NovoPedido, transacao: Transacao): Promise<number> {
  const pedido = await Pedido.create(
    { valor_total: dados.valor_total, valor_frete: dados.valor_frete, status: 'AGUARDANDO_PAGAMENTO', ativo: false },
    { transaction: transacao }
  );
  await ItemPedido.bulkCreate(
    dados.itens.map((item) => ({
      id_pedido: pedido.id_pedido,
      id_produto: item.id_produto,
      nome_produto: item.nome_produto.slice(0, 150),
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })),
    { transaction: transacao }
  );
  await EnderecoPedido.create(
    {
      id_pedido: pedido.id_pedido,
      endereco: dados.endereco.endereco,
      numero: dados.endereco.numero,
      complemento: dados.endereco.complemento,
      bairro: dados.endereco.bairro,
      cidade: dados.endereco.cidade,
      estado: dados.endereco.estado,
      cep: dados.endereco.cep,
    },
    { transaction: transacao }
  );
  await UsuarioPedido.create(
    {
      id_pedido: pedido.id_pedido,
      id_usuario: dados.cliente.id_usuario,
      nome: dados.cliente.nome,
      email: dados.cliente.email,
      cpf: dados.cliente.cpf,
      telefone: dados.cliente.telefone,
    },
    { transaction: transacao }
  );
  return pedido.id_pedido;
}

export function tornarVisivel(idPedido: number, transacao: Transacao) {
  return Pedido.update({ ativo: true }, { where: { id_pedido: idPedido }, transaction: transacao });
}

export async function descartarInvisivel(idPedido: number, transacao: Transacao) {
  await ItemPedido.destroy({ where: { id_pedido: idPedido }, transaction: transacao });
  await EnderecoPedido.destroy({ where: { id_pedido: idPedido }, transaction: transacao });
  await UsuarioPedido.destroy({ where: { id_pedido: idPedido }, transaction: transacao });
  await Pedido.destroy({ where: { id_pedido: idPedido, ativo: false }, transaction: transacao });
}

export function buscarPorId(id: number) {
  return Pedido.findByPk(id);
}

export function buscarDetalhe(id: number) {
  return Pedido.findByPk(id, { include: incluirDetalhe, order: ordemItens });
}

export async function listar(filtro: FiltroListagem) {
  const cliente = {
    model: UsuarioPedido,
    as: 'cliente',
    attributes: atributosCliente,
    ...(filtro.idUsuario === undefined ? {} : { where: { id_usuario: filtro.idUsuario }, required: true }),
  };
  const where = { ativo: true, ...(filtro.status && { status: filtro.status }) };

  const { rows, count } = await Pedido.findAndCountAll({
    where,
    include: [cliente],
    order: [['data', 'DESC'], ['id_pedido', 'DESC']],
    limit: filtro.limite,
    offset: (filtro.pagina - 1) * filtro.limite,
  });
  return { registros: rows, total: count };
}

export async function trocarStatus(id: number, de: StatusPedido, para: StatusPedido) {
  const [alterados] = await Pedido.update({ status: para }, { where: { id_pedido: id, status: de } });
  return alterados > 0;
}

export async function buscarIdsVencidos(anterioresA: Date, maximo: number): Promise<number[]> {
  const pedidos = await Pedido.findAll({
    where: { status: 'AGUARDANDO_PAGAMENTO', ativo: true, data: { [Op.lt]: anterioresA } },
    attributes: ['id_pedido'],
    order: [['data', 'ASC']],
    limit: maximo,
  });
  return pedidos.map((p) => p.id_pedido);
}

export async function buscarIdsInvisiveisAntigos(anterioresA: Date, maximo: number): Promise<number[]> {
  const pedidos = await Pedido.findAll({
    where: { status: 'AGUARDANDO_PAGAMENTO', ativo: false, data: { [Op.lt]: anterioresA } },
    attributes: ['id_pedido'],
    order: [['data', 'ASC']],
    limit: maximo,
  });
  return pedidos.map((p) => p.id_pedido);
}
