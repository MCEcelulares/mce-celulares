import { Op, WhereOptions, fn, literal } from 'sequelize';
import { Categoria, Marca, Produto } from '../models';
import { escaparLike } from '../utils/like';
import { ListarProdutosQuery } from '../validators/produtoValidators';
import { Transacao } from './transacao';

const incluirRelacionados = [
  { model: Marca, as: 'marca', attributes: ['id_marca', 'nome'] },
  { model: Categoria, as: 'categoria', attributes: ['id_categoria', 'nome'] },
];

const ordenacoes: Record<ListarProdutosQuery['ordenar'], [string, string][]> = {
  recentes: [['criado_em', 'DESC'], ['id_produto', 'DESC']],
  preco_asc: [['preco', 'ASC'], ['id_produto', 'ASC']],
  preco_desc: [['preco', 'DESC'], ['id_produto', 'ASC']],
};

export type CriteriosListagem = Omit<ListarProdutosQuery, 'incluirInativos'>;

export type CamposProduto = Partial<
  Pick<Produto, 'nome' | 'descricao' | 'preco' | 'estoque' | 'imagem' | 'destaque' | 'ativo' | 'id_marca' | 'id_categoria'>
>;

export function buscarPorIdComRelacionados(id: number) {
  return Produto.findByPk(id, { include: incluirRelacionados });
}

export function buscarPorId(id: number, transacao?: Transacao) {
  return Produto.findByPk(id, transacao ? { transaction: transacao } : undefined);
}

export async function listar(criterios: CriteriosListagem, verInativos: boolean) {
  const condicoes: WhereOptions[] = [];
  if (!verInativos) condicoes.push({ ativo: true });
  if (criterios.categoria) condicoes.push({ id_categoria: criterios.categoria });
  if (criterios.marca) condicoes.push({ id_marca: criterios.marca });
  if (criterios.precoMin !== undefined) condicoes.push({ preco: { [Op.gte]: criterios.precoMin } });
  if (criterios.precoMax !== undefined) condicoes.push({ preco: { [Op.lte]: criterios.precoMax } });
  if (criterios.disponivel) condicoes.push({ estoque: { [Op.gt]: 0 } });

  const palavras = (criterios.busca ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  for (const palavra of palavras) {
    condicoes.push({ nome: { [Op.like]: `%${escaparLike(palavra)}%` } });
  }

  const where = condicoes.length === 0 ? {} : condicoes.length === 1 ? condicoes[0] : { [Op.and]: condicoes };
  const { rows, count } = await Produto.findAndCountAll({
    where,
    include: incluirRelacionados,
    order: ordenacoes[criterios.ordenar],
    limit: criterios.limite,
    offset: (criterios.pagina - 1) * criterios.limite,
  });
  return { registros: rows, total: count };
}

function vitrine(where: WhereOptions, limite: number) {
  return Produto.findAll({ where, include: incluirRelacionados, order: ordenacoes.recentes, limit: limite });
}

export const listarDestaques = (limite: number) => vitrine({ ativo: true, destaque: true }, limite);
export const listarRecentes = (limite: number) => vitrine({ ativo: true }, limite);

export function consultarPorIds(ids: number[]) {
  return Produto.findAll({ where: { id_produto: [...new Set(ids)] }, order: [['id_produto', 'ASC']] });
}

export function criar(dados: CamposProduto & Pick<Produto, 'nome' | 'preco' | 'id_marca' | 'id_categoria'>) {
  return Produto.create(dados);
}

export function atualizar(produto: Produto, campos: CamposProduto) {
  return produto.update(campos);
}

export function contarPorCategoria(idCategoria: number) {
  return Produto.count({ where: { id_categoria: idCategoria } });
}

export function contarPorMarca(idMarca: number) {
  return Produto.count({ where: { id_marca: idMarca } });
}

// Soma (ou subtrai, se negativo) no próprio UPDATE. Uma baixa só acontece se ainda houver estoque suficiente.
export async function ajustarEstoque(id: number, ajuste: number) {
  const [alterados] = await Produto.update(
    { estoque: literal(`estoque + ${Math.trunc(ajuste)}`) },
    { where: { id_produto: id, ...(ajuste < 0 ? { estoque: { [Op.gte]: -ajuste } } : {}) } }
  );
  return alterados > 0;
}

// Vale também para produto inativo. Devolve false se o produto não existe.
export async function reporEstoque(id: number, quantidade: number) {
  const [afetadas] = await Produto.update(
    { estoque: literal(`estoque + ${Math.trunc(quantidade)}`) },
    { where: { id_produto: id } }
  );
  return afetadas > 0;
}

// ---- operações da reserva de estoque (sempre dentro de uma transação) ----

// Trava as linhas em ordem fixa de id: serializa reservas concorrentes dos mesmos itens sem deadlock.
export function travarPorIds(ids: number[], transacao: Transacao) {
  return Produto.findAll({
    where: { id_produto: ids },
    order: [['id_produto', 'ASC']],
    transaction: transacao,
    lock: transacao.LOCK.UPDATE,
  });
}

// Baixa atômica e condicional: só desconta se o produto está ativo e ainda há estoque (sem ler e depois escrever).
export async function baixarSeHouver(id: number, quantidade: number, transacao: Transacao) {
  const [alterados] = await Produto.update(
    { estoque: literal(`estoque - ${quantidade}`) },
    { where: { id_produto: id, ativo: true, estoque: { [Op.gte]: quantidade } }, transaction: transacao }
  );
  return alterados > 0;
}

export function devolverQuantidade(id: number, quantidade: number, transacao: Transacao) {
  return Produto.update(
    { estoque: literal(`estoque + ${quantidade}`) },
    { where: { id_produto: id }, transaction: transacao }
  );
}

// ---- painel (RF46) ----

export async function contagens() {
  const [total, ativos, semEstoque, emDestaque] = await Promise.all([
    Produto.count(),
    Produto.count({ where: { ativo: true } }),
    Produto.count({ where: { ativo: true, estoque: 0 } }),
    Produto.count({ where: { ativo: true, destaque: true } }),
  ]);
  const estoque = (await Produto.findOne({
    attributes: [[fn('SUM', literal('preco * estoque')), 'valor']],
    where: { ativo: true },
    raw: true,
  })) as unknown as { valor: string | null } | null;

  return { total, ativos, semEstoque, emDestaque, valorEmEstoque: Number(estoque?.valor ?? 0) };
}
