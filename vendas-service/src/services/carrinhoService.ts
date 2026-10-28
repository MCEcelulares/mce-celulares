import { Order, UniqueConstraintError } from 'sequelize';
import { Carrinho, ItemCarrinho } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import * as catalogo from '../clients/catalogoClient';

const incluirItens = [{ model: ItemCarrinho, as: 'itens' }];
const ordemItens: Order = [[{ model: ItemCarrinho, as: 'itens' }, 'id_item_carrinho', 'ASC']];

// Valores em centavos para somar sem erro de ponto flutuante.
export const centavos = (valor: number | string) => Math.round(Number(valor) * 100);

export function paraResposta(carrinho: Carrinho) {
  const itens = (carrinho.itens ?? []).map((item) => {
    const preco = Number(item.preco_unitario);
    return {
      id_item_carrinho: item.id_item_carrinho,
      id_produto: item.id_produto,
      quantidade: item.quantidade,
      preco_unitario: preco,
      subtotal: (centavos(preco) * item.quantidade) / 100,
    };
  });
  const total = itens.reduce((soma, item) => soma + centavos(item.subtotal), 0) / 100;
  return { id_carrinho: carrinho.id_carrinho, itens, total };
}

export function carregarCarrinhoAtivo(idUsuario: number) {
  return Carrinho.findOne({ where: { id_usuario: idUsuario, ativo: true }, include: incluirItens, order: ordemItens });
}

async function obterOuCriarCarrinho(idUsuario: number) {
  const existente = await carregarCarrinhoAtivo(idUsuario);
  if (existente) return existente;
  const novo = await Carrinho.create({ id_usuario: idUsuario });
  novo.itens = [];
  return novo;
}

function garantirEstoque(produto: catalogo.ProdutoCatalogo, quantidade: number) {
  if (quantidade > produto.estoque) {
    throw new ErroHttp(409, `Estoque insuficiente (disponível: ${produto.estoque})`);
  }
}

export async function buscarCarrinho(idUsuario: number) {
  return paraResposta(await obterOuCriarCarrinho(idUsuario));
}

export async function adicionarItem(idUsuario: number, idProduto: number, quantidade: number) {
  const produto = await catalogo.buscarProduto(idProduto);
  if (!produto) throw new ErroHttp(404, 'Produto não existe');

  const carrinho = await obterOuCriarCarrinho(idUsuario);
  const existente = carrinho.itens?.find((item) => item.id_produto === idProduto);
  const novaQuantidade = (existente?.quantidade ?? 0) + quantidade;
  garantirEstoque(produto, novaQuantidade);

  try {
    if (existente) {
      await existente.update({ quantidade: novaQuantidade, preco_unitario: produto.preco });
    } else {
      await ItemCarrinho.create({
        id_carrinho: carrinho.id_carrinho,
        id_produto: idProduto,
        preco_unitario: produto.preco,
        quantidade,
      });
    }
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Este produto já está sendo adicionado ao carrinho, tente novamente');
    }
    throw err;
  }
  return buscarCarrinho(idUsuario);
}

async function obterItemDoCarrinho(idUsuario: number, idItem: number) {
  const carrinho = await obterOuCriarCarrinho(idUsuario);
  const item = carrinho.itens?.find((i) => i.id_item_carrinho === idItem);
  if (!item) throw new ErroHttp(404, 'Item não existe no carrinho');
  return item;
}

export async function atualizarItem(idUsuario: number, idItem: number, quantidade: number) {
  const item = await obterItemDoCarrinho(idUsuario, idItem);

  const produto = await catalogo.buscarProduto(item.id_produto);
  if (!produto) throw new ErroHttp(409, 'Este produto não está mais disponível');
  garantirEstoque(produto, quantidade);

  await item.update({ quantidade, preco_unitario: produto.preco });
  return buscarCarrinho(idUsuario);
}

export async function removerItem(idUsuario: number, idItem: number) {
  const item = await obterItemDoCarrinho(idUsuario, idItem);
  await item.destroy();
}
