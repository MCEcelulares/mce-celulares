import { ForeignKeyConstraintError, Op, literal, Order } from 'sequelize';
import { Categoria, Marca, Produto } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { apagarCache, gravarCache, lerCache } from '../utils/cache';
import { registrarEvento } from '../utils/metricas';
import { AtualizarProduto, CriarProduto, FiltrosProduto } from '../validators/produtoValidators';

const incluir = [
  { model: Marca, as: 'marca', attributes: ['id_marca', 'nome'] },
  { model: Categoria, as: 'categoria', attributes: ['id_categoria', 'nome'] },
];

const ordenacoes: Record<FiltrosProduto['ordenar'], Order> = {
  recentes: [['criado_em', 'DESC'], ['id_produto', 'DESC']],
  preco_asc: [['preco', 'ASC'], ['id_produto', 'ASC']],
  preco_desc: [['preco', 'DESC'], ['id_produto', 'DESC']],
};

const chaveCache = (id: number) => `produto:${id}`;
const numero = (valor: unknown) => (valor === null || valor === undefined ? null : Number(valor));

// O MySQL devolve DECIMAL como texto; a API expõe número.
export function paraResposta(produto: Produto) {
  const { preco, peso, altura, largura, comprimento, ...resto } = produto.toJSON();
  return {
    ...resto,
    preco: Number(preco),
    peso: numero(peso),
    altura: numero(altura),
    largura: numero(largura),
    comprimento: numero(comprimento),
  };
}

type ProdutoResposta = ReturnType<typeof paraResposta>;

const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, '\\$&');

function traduzirErroDeChave(err: unknown): never {
  if (err instanceof ForeignKeyConstraintError) {
    throw new ErroHttp(400, 'Marca ou categoria inexistente');
  }
  throw err;
}

export async function listarProdutos(filtros: FiltrosProduto) {
  const where: Record<string, unknown> = { ativo: true };
  if (filtros.categoria) where.id_categoria = filtros.categoria;
  if (filtros.marca) where.id_marca = filtros.marca;
  if (filtros.busca) where.nome = { [Op.like]: `%${escaparLike(filtros.busca)}%` };
  if (filtros.disponivel) where.estoque = { [Op.gt]: 0 };
  if (filtros.precoMin !== undefined || filtros.precoMax !== undefined) {
    where.preco = {
      ...(filtros.precoMin !== undefined && { [Op.gte]: filtros.precoMin }),
      ...(filtros.precoMax !== undefined && { [Op.lte]: filtros.precoMax }),
    };
  }

  const { rows, count } = await Produto.findAndCountAll({
    where,
    include: incluir,
    order: ordenacoes[filtros.ordenar],
    limit: filtros.limite,
    offset: (filtros.pagina - 1) * filtros.limite,
    distinct: true,
  });

  return { dados: rows.map(paraResposta), pagina: filtros.pagina, limite: filtros.limite, total: count };
}

export async function listarDestaques(limite: number) {
  const produtos = await Produto.findAll({
    where: { ativo: true, destaque: true },
    include: incluir,
    order: ordenacoes.recentes,
    limit: limite,
  });
  return produtos.map(paraResposta);
}

export async function listarRecentes(limite: number) {
  const produtos = await Produto.findAll({
    where: { ativo: true },
    include: incluir,
    order: ordenacoes.recentes,
    limit: limite,
  });
  return produtos.map(paraResposta);
}

export async function buscarProduto(id: number): Promise<ProdutoResposta> {
  const emCache = await lerCache<ProdutoResposta>(chaveCache(id));
  if (emCache) return emCache;

  const produto = await Produto.findOne({ where: { id_produto: id, ativo: true }, include: incluir });
  if (!produto) throw new ErroHttp(404, 'Produto não existe');

  const resposta = paraResposta(produto);
  await gravarCache(chaveCache(id), resposta);
  return resposta;
}

export async function criarProduto(dados: CriarProduto) {
  let produto;
  try {
    produto = await Produto.create(dados);
  } catch (err) {
    traduzirErroDeChave(err);
  }
  const completo = await Produto.findByPk(produto.id_produto, { include: incluir });
  return paraResposta(completo!);
}

export async function atualizarProduto(id: number, dados: AtualizarProduto) {
  const produto = await Produto.findByPk(id);
  if (!produto) throw new ErroHttp(404, 'Produto não existe');

  try {
    await produto.update(dados);
  } catch (err) {
    traduzirErroDeChave(err);
  }
  await apagarCache(chaveCache(id));

  const completo = await Produto.findByPk(id, { include: incluir });
  return paraResposta(completo!);
}

// Baixa atômica: o UPDATE só acontece se ainda houver estoque, evitando venda acima do estoque
// mesmo com dois pedidos simultâneos.
export async function baixarEstoque(id: number, quantidade: number) {
  const [afetadas] = await Produto.update(
    { estoque: literal(`estoque - ${quantidade}`) as unknown as number },
    { where: { id_produto: id, ativo: true, estoque: { [Op.gte]: quantidade } } }
  );

  if (afetadas === 0) {
    const produto = await Produto.findByPk(id);
    if (!produto || !produto.ativo) throw new ErroHttp(404, 'Produto não existe');
    registrarEvento('estoque_insuficiente');
    throw new ErroHttp(409, 'Estoque insuficiente');
  }

  await apagarCache(chaveCache(id));
  registrarEvento('estoque_baixado');
  const atualizado = await Produto.findByPk(id);
  return { id_produto: id, estoque: atualizado!.estoque };
}
