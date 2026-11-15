import { createHash } from 'crypto';
import type { Categoria, Marca, Produto } from '../models';
import * as produtoRepository from '../repositories/produtoRepository';
import * as marcaRepository from '../repositories/marcaRepository';
import * as categoriaRepository from '../repositories/categoriaRepository';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { invalidarCatalogo, obterOuCarregar } from './cacheService';
import { apagarImagem, gravarImagem, urlDaImagem } from './imagemService';
import {
  CriarProdutoInput,
  AtualizarProdutoInput,
  ListarProdutosQuery,
} from '../validators/produtoValidators';

function paraResposta(produto: Produto) {
  const registro: Record<string, unknown> =
    typeof (produto as Produto & { toJSON?: () => Record<string, unknown> }).toJSON === 'function'
      ? ((produto as Produto & { toJSON: () => Record<string, unknown> }).toJSON() as unknown as Record<string, unknown>)
      : (produto as unknown as Record<string, unknown>);
  return {
    id_produto: registro.id_produto,
    nome: registro.nome,
    descricao: registro.descricao,
    preco: Number(registro.preco),
    estoque: registro.estoque,
    imagem: urlDaImagem(registro.imagem as string | null | undefined),
    destaque: registro.destaque,
    ativo: registro.ativo,
    id_marca: registro.id_marca,
    id_categoria: registro.id_categoria,
    marca: registro.marca
      ? { id_marca: (registro.marca as Marca).id_marca, nome: (registro.marca as Marca).nome }
      : null,
    categoria: registro.categoria
      ? {
          id_categoria: (registro.categoria as Categoria).id_categoria,
          nome: (registro.categoria as Categoria).nome,
        }
      : null,
    criado_em: registro.criado_em,
  };
}

async function obterProdutoOuFalhar(id: number) {
  const produto = await produtoRepository.buscarPorIdComRelacionados(id);
  if (!produto) {
    throw new ErroHttp(404, 'Produto não existe');
  }
  return produto;
}

async function garantirMarcaECategoria(idMarca?: number, idCategoria?: number) {
  if (idMarca !== undefined && !(await marcaRepository.buscarPorId(idMarca))) {
    throw new ErroHttp(400, 'Marca não existe');
  }
  if (idCategoria !== undefined && !(await categoriaRepository.buscarPorId(idCategoria))) {
    throw new ErroHttp(400, 'Categoria não existe');
  }
}

export async function listarProdutos(filtros: ListarProdutosQuery, verInativos: boolean) {
  const { incluirInativos: _ignorado, ...criterios } = filtros;

  const carregar = async () => {
    const { registros, total } = await produtoRepository.listar(criterios, verInativos);

    return {
      dados: registros.map(paraResposta),
      paginacao: {
        pagina: criterios.pagina,
        limite: criterios.limite,
        total,
        totalPaginas: Math.ceil(total / criterios.limite),
      },
    };
  };

  if (verInativos) return carregar();
  const chave = createHash('sha1').update(JSON.stringify(criterios)).digest('hex');
  return obterOuCarregar(`produtos:lista:${chave}`, carregar);
}

async function vitrine(chave: string, limite: number, buscar: (limite: number) => Promise<Produto[]>) {
  return obterOuCarregar(`produtos:${chave}:${limite}`, async () => (await buscar(limite)).map(paraResposta));
}

export const listarDestaques = (limite: number) => vitrine('destaque', limite, produtoRepository.listarDestaques);
export const listarRecentes = (limite: number) => vitrine('recentes', limite, produtoRepository.listarRecentes);

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

  const produto = await produtoRepository.criar(dados);
  await invalidarCatalogo();
  registrarEvento('produto_criado');
  logger.info({ id_produto: produto.id_produto, nome: produto.nome, criadoPor }, 'produto criado');
  return paraResposta(await obterProdutoOuFalhar(produto.id_produto));
}

export async function atualizarProduto(id: number, dados: AtualizarProdutoInput, alteradoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  await garantirMarcaECategoria(dados.id_marca, dados.id_categoria);

  await produtoRepository.atualizar(produto, dados);
  await invalidarCatalogo();
  logger.info({ id_produto: id, campos: Object.keys(dados), alteradoPor }, 'produto atualizado');
  return paraResposta(await obterProdutoOuFalhar(id));
}

// Produto nunca é apagado: pedidos antigos guardam snapshot, e o histórico do estoque aponta para ele (RF12 permite inativar).
export async function inativarProduto(id: number, inativadoPor: number) {
  const produto = await obterProdutoOuFalhar(id);
  if (produto.ativo) {
    await produtoRepository.atualizar(produto, { ativo: false });
    await invalidarCatalogo();
    registrarEvento('produto_inativado');
  }
  logger.info({ id_produto: id, inativadoPor }, 'produto inativado');
}

export async function ajustarEstoque(id: number, ajuste: number, alteradoPor: number) {
  await obterProdutoOuFalhar(id);

  const alterado = await produtoRepository.ajustarEstoque(id, ajuste);
  if (!alterado) {
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
    await produtoRepository.atualizar(produto, { imagem: nova });
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
  await produtoRepository.atualizar(produto, { imagem: null });
  await apagarImagem(anterior);
  await invalidarCatalogo();
  logger.info({ id_produto: id, removidoPor }, 'imagem do produto removida');
}

export async function consultarProdutosInterno(ids: number[]) {
  const produtos = await produtoRepository.consultarPorIds(ids);
  return produtos.map((p) => ({
    id_produto: p.id_produto,
    nome: p.nome,
    preco: Number(p.preco),
    estoque: p.estoque,
    ativo: p.ativo,
    imagem: urlDaImagem(p.imagem),
  }));
}

// Devolve estoque (pedido cancelado ou criação de pedido que falhou no meio). Vale também para produto inativo.
export async function reporEstoque(id: number, quantidade: number) {
  const encontrado = await produtoRepository.reporEstoque(id, quantidade);
  if (!encontrado) throw new ErroHttp(404, 'Produto não existe');

  await invalidarCatalogo();
  registrarEvento('estoque_reposto');
  const atualizado = await produtoRepository.buscarPorId(id);
  return { id_produto: id, estoque: atualizado!.estoque };
}

// RF46: contagens do catálogo para o painel (usuários e pedidos saem dos serviços donos desses dados, ADR-012).
export async function resumoDoCatalogo() {
  const c = await produtoRepository.contagens();

  return {
    total_produtos: c.total,
    produtos_ativos: c.ativos,
    produtos_inativos: c.total - c.ativos,
    produtos_sem_estoque: c.semEstoque,
    produtos_em_destaque: c.emDestaque,
    valor_em_estoque: c.valorEmEstoque,
  };
}
