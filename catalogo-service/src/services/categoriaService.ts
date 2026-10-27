import { Categoria } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { z } from 'zod';
import { atualizarCategoriaSchema, criarCategoriaSchema } from '../validators/categoriaValidators';

export async function listarCategorias() {
  return Categoria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
}

export async function criarCategoria(dados: z.infer<typeof criarCategoriaSchema>) {
  return Categoria.create(dados);
}

export async function atualizarCategoria(id: number, dados: z.infer<typeof atualizarCategoriaSchema>) {
  const categoria = await Categoria.findByPk(id);
  if (!categoria) throw new ErroHttp(404, 'Categoria não existe');
  return categoria.update(dados);
}
