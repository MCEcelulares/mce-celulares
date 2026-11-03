import { UniqueConstraintError } from 'sequelize';
import { Categoria, Produto } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { invalidarCatalogo, obterOuCarregar } from './cacheService';
import { CriarCategoriaInput, AtualizarCategoriaInput } from '../validators/categoriaValidators';

function paraResposta(categoria: Categoria) {
  return {
    id_categoria: categoria.id_categoria,
    nome: categoria.nome,
    icone: categoria.icone,
    ativo: categoria.ativo,
  };
}

async function obterCategoriaOuFalhar(id: number) {
  const categoria = await Categoria.findByPk(id);
  if (!categoria) {
    throw new ErroHttp(404, 'Categoria não existe');
  }
  return categoria;
}

export async function listarCategorias(verInativos: boolean) {
  const carregar = async () => {
    const categorias = await Categoria.findAll({
      where: verInativos ? {} : { ativo: true },
      order: [['nome', 'ASC']],
    });
    return categorias.map(paraResposta);
  };
  return verInativos ? carregar() : obterOuCarregar('categorias:lista', carregar);
}

export async function buscarCategoria(id: number, verInativos: boolean) {
  const categoria = await obterCategoriaOuFalhar(id);
  if (!categoria.ativo && !verInativos) {
    throw new ErroHttp(404, 'Categoria não existe');
  }
  return paraResposta(categoria);
}

export async function criarCategoria(dados: CriarCategoriaInput, criadoPor: number) {
  try {
    const categoria = await Categoria.create(dados);
    await invalidarCatalogo();
    registrarEvento('categoria_criada');
    logger.info({ id_categoria: categoria.id_categoria, nome: categoria.nome, criadoPor }, 'categoria criada');
    return paraResposta(categoria);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma categoria com esse nome');
    }
    throw err;
  }
}

export async function atualizarCategoria(id: number, dados: AtualizarCategoriaInput, alteradoPor: number) {
  const categoria = await obterCategoriaOuFalhar(id);
  try {
    await categoria.update(dados);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma categoria com esse nome');
    }
    throw err;
  }
  await invalidarCatalogo();
  logger.info({ id_categoria: id, alteradoPor }, 'categoria atualizada');
  return paraResposta(categoria);
}

export async function excluirCategoria(id: number, excluidoPor: number) {
  const categoria = await obterCategoriaOuFalhar(id);

  const emUso = await Produto.count({ where: { id_categoria: id } });
  if (emUso > 0) {
    throw new ErroHttp(409, `A categoria possui ${emUso} produto(s). Mova os produtos ou inative a categoria em vez de excluir`);
  }

  await categoria.destroy();
  await invalidarCatalogo();
  logger.info({ id_categoria: id, nome: categoria.nome, excluidoPor }, 'categoria excluída');
}
