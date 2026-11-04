import { createHash } from 'crypto';
import { Op, WhereOptions, literal } from 'sequelize';
import { Categoria, Marca, Produto } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { escaparLike } from '../utils/like';
import { invalidarCatalogo, obterOuCarregar } from './cacheService';
import { apagarImagem, gravarImagem, urlDaImagem } from './imagemService';
import {
  CriarProdutoInput,
  AtualizarProdutoInput,
  ListarProdutosQuery,
} from '../validators/produtoValidators';

const incluirRelacionados = [
  { model: Marca, as: 'marca', attributes: ['id_marca', 'nome'] },
  { model: Categoria, as: 'categoria', attributes: ['id_categoria', 'nome'] },
];

const ordenacoes: Record<ListarProdutosQuery['ordenar'], [string, string][]> = {
  recentes: [['criado_em', 'DESC'], ['id_produto', 'DESC']],
  preco_asc: [['preco', 'ASC'], ['id_produto', 'ASC']],
  preco_desc: [['preco', 'DESC'], ['id_produto', 'ASC']],
};

function paraResposta(produto: Produto) {
  return {
    id_produto: produto.id_produto,
    nome: produto.nome,
    descricao: produto.descricao,
    preco: Number(produto.preco),
    estoque: produto.estoque,
    imagem: urlDaImagem(produto.imagem),
    destaque: produto.destaque,
    ativo: produto.ativo,
    id_marca: produto.id_marca,
    id_categoria: produto.id_categoria,
    marca: produto.marca ? { id_marca: produto.marca.id_marca, nome: produto.marca.nome } : null,
    categoria: produto.categoria
      ? { id_categoria: produto.categoria.id_categoria, nome: produto.categoria.nome }
      : null,
    criado_em: produto.criado_em,
  };
}

async function obterProdutoOuFalhar(id: number) {
  const produto = await Produto.findByPk(id, { include: incluirRelacionados });
  if (!produto) {
    throw new ErroHttp(404, 'Produto não existe');
  }
  return produto;
}

async function garantirMarcaECategoria(idMarca?: number, idCategoria?: number) {
  if (idMarca !== undefined && !(await Marca.findByPk(idMarca))) {
    throw new ErroHttp(400, 'Marca não existe');
  }
  if (idCategoria !== undefined && !(await Categoria.findByPk(idCategoria))) {
    throw new ErroHttp(400, 'Categoria não existe');
  }
}

export async function listarProdutos(filtros: ListarProdutosQuery, verInativos: boolean) {
  const { incluirInativos: _ignorado, ...criterios } = filtros;

  const carregar = async () => {
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

    const { rows, count } = await Produto.findAndCountAll({
      where: { [Op.and]: condicoes },
      include: incluirRelacionados,
      order: ordenacoes[criterios.ordenar],
      limit: criterios.limite,
      offset: (criterios.pagina - 1) * criterios.limite,
    });

    return {
      dados: rows.map(paraResposta),
      paginacao: {
        pagina: criterios.pagina,
        limite: criterios.limite,
        total: count,
        totalPaginas: Math.ceil(count / criterios.limite),
      },
    };
  };

  if (verInativos) return carregar();
  const chave = createHash('sha1').update(JSON.stringify(criterios)).digest('hex');
  return obterOuCarregar(`produtos:lista:${chave}`, carregar);
}

async function vitrine(chave: string, where: WhereOptions, limite: number) {
  return obterOuCarregar(`produtos:${chave}:${limite}`, async () => {
    const produtos = await Produto.findAll({
      where,
      include: incluirRelacionados,
      order: ordenacoes.recentes,
      limit: limite,
    });
    return produtos.map(paraResposta);
  });
}

export const listarDestaques = (limite: number) => vitrine('destaque', { ativo: true, destaque: true }, limite);
export const listarRecentes = (limite: number) => vitrine('recentes', { ativo: true }, limite);

export async function buscarProduto(id: number, verInativos: boolean) {
  if (verInativos) return paraResposta(await obterProdutoOuFalhar(id));

  return obterOuCarregar(`produtos:${id}`, async () => {
    const produto = await obterProdutoOuFalhar(id);
    if (!produto.ativo) {
      throw new ErroHttp(404, 'Produto não existe');
    }
    return paraResposta(produto);
  });
}

export async function criarProduto(dados: CriarProdutoInput, criadoPor: number) {
  await garantirMarcaECategoria(dados.id_marca, dados.id_categoria);

  const produto = await Produto.create(dados);
  await invalidarCatalogo();
  registrarEvento('produto_criado');
  logger.info({ id_produto: produto.id_produto, nome: produto.nome, criadoPor }, 'produto criado');
  return paraResposta(await obterProdutoOuFalhar(produto.id_produto));
}

export async function atualizarProduto(id: number, dados: AtualizarProdutoInput, alteradoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  await garantirMarcaECategoria(dados.id_marca, dados.id_categoria);

  await produto.update(dados);
  await invalidarCatalogo();
  logger.info({ id_produto: id, campos: Object.keys(dados), alteradoPor }, 'produto atualizado');
  return paraResposta(await obterProdutoOuFalhar(id));
}

// Produto nunca é apagado: pedidos antigos guardam snapshot, e o histórico do estoque aponta para ele (RF12 permite inativar).
export async function inativarProduto(id: number, inativadoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  if (produto.ativo) {
    await produto.update({ ativo: false });
    await invalidarCatalogo();
    registrarEvento('produto_inativado');
  }
  logger.info({ id_produto: id, inativadoPor }, 'produto inativado');
}

export async function ajustarEstoque(id: number, ajuste: number, alteradoPor: number) {
  await obterProdutoOuFalhar(id);

  const [alterados] = await Produto.update(
    { estoque: literal(`estoque + ${Math.trunc(ajuste)}`) },
    { where: { id_produto: id, ...(ajuste < 0 ? { estoque: { [Op.gte]: -ajuste } } : {}) } }
  );
  if (alterados === 0) {
    throw new ErroHttp(409, 'Estoque insuficiente para essa baixa');
  }

  await invalidarCatalogo();
  registrarEvento('estoque_ajustado');
  logger.info({ id_produto: id, ajuste, alteradoPor }, 'estoque ajustado');
  return paraResposta(await obterProdutoOuFalhar(id));
}

export async function trocarImagem(id: number, arquivo: Buffer, alteradoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  const anterior = produto.imagem;

  const nova = await gravarImagem(arquivo);
  try {
    await produto.update({ imagem: nova });
  } catch (err) {
    await apagarImagem(nova);
    throw err;
  }

  await apagarImagem(anterior);
  await invalidarCatalogo();
  logger.info({ id_produto: id, imagem: nova, alteradoPor }, 'imagem do produto atualizada');
  return paraResposta(await obterProdutoOuFalhar(id));
}

export async function removerImagem(id: number, removidoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  if (!produto.imagem) return;

  const anterior = produto.imagem;
  await produto.update({ imagem: null });
  await apagarImagem(anterior);
  await invalidarCatalogo();
  logger.info({ id_produto: id, removidoPor }, 'imagem do produto removida');
}

export async function consultarProdutosInterno(ids: number[]) {
  const produtos = await Produto.findAll({ where: { id_produto: [...new Set(ids)] }, order: [['id_produto', 'ASC']] });
  return produtos.map((p) => ({
    id_produto: p.id_produto,
    nome: p.nome,
    preco: Number(p.preco),
    estoque: p.estoque,
    ativo: p.ativo,
    imagem: urlDaImagem(p.imagem),
  }));
}
