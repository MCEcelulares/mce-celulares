import { UniqueConstraintError } from 'sequelize';
import { Marca, Produto } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { invalidarCatalogo, obterOuCarregar } from './cacheService';
import { CriarMarcaInput, AtualizarMarcaInput } from '../validators/marcaValidators';

function paraResposta(marca: Marca) {
  return { id_marca: marca.id_marca, nome: marca.nome, ativo: marca.ativo };
}

async function obterMarcaOuFalhar(id: number) {
  const marca = await Marca.findByPk(id);
  if (!marca) {
    throw new ErroHttp(404, 'Marca não existe');
  }
  return marca;
}

export async function listarMarcas(verInativos: boolean) {
  const carregar = async () => {
    const marcas = await Marca.findAll({
      where: verInativos ? {} : { ativo: true },
      order: [['nome', 'ASC']],
    });
    return marcas.map(paraResposta);
  };
  return verInativos ? carregar() : obterOuCarregar('marcas:lista', carregar);
}

export async function buscarMarca(id: number, verInativos: boolean) {
  const marca = await obterMarcaOuFalhar(id);
  if (!marca.ativo && !verInativos) {
    throw new ErroHttp(404, 'Marca não existe');
  }
  return paraResposta(marca);
}

export async function criarMarca(dados: CriarMarcaInput, criadoPor: number) {
  try {
    const marca = await Marca.create(dados);
    await invalidarCatalogo();
    registrarEvento('marca_criada');
    logger.info({ id_marca: marca.id_marca, nome: marca.nome, criadoPor }, 'marca criada');
    return paraResposta(marca);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma marca com esse nome');
    }
    throw err;
  }
}

export async function atualizarMarca(id: number, dados: AtualizarMarcaInput, alteradoPor: number) {
  const marca = await obterMarcaOuFalhar(id);
  try {
    await marca.update(dados);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new ErroHttp(409, 'Já existe uma marca com esse nome');
    }
    throw err;
  }
  await invalidarCatalogo();
  logger.info({ id_marca: id, alteradoPor }, 'marca atualizada');
  return paraResposta(marca);
}

export async function excluirMarca(id: number, excluidoPor: number) {
  const marca = await obterMarcaOuFalhar(id);

  const emUso = await Produto.count({ where: { id_marca: id } });
  if (emUso > 0) {
    throw new ErroHttp(409, `A marca possui ${emUso} produto(s). Mova os produtos ou inative a marca em vez de excluir`);
  }

  await marca.destroy();
  await invalidarCatalogo();
  logger.info({ id_marca: id, nome: marca.nome, excluidoPor }, 'marca excluída');
}
