import { Marca } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { z } from 'zod';
import { atualizarMarcaSchema, criarMarcaSchema } from '../validators/categoriaValidators';

export async function listarMarcas() {
  return Marca.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
}

export async function criarMarca(dados: z.infer<typeof criarMarcaSchema>) {
  return Marca.create(dados);
}

export async function atualizarMarca(id: number, dados: z.infer<typeof atualizarMarcaSchema>) {
  const marca = await Marca.findByPk(id);
  if (!marca) throw new ErroHttp(404, 'Marca não existe');
  return marca.update(dados);
}
