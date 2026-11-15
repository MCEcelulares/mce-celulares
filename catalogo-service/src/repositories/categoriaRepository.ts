import { UniqueConstraintError } from 'sequelize';
import { Categoria } from '../models';
import { RegistroDuplicadoError } from './erros';

export type CamposCategoria = Partial<Pick<Categoria, 'nome' | 'icone' | 'ativo'>>;

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function listar(verInativos: boolean) {
  return Categoria.findAll({
    where: verInativos ? {} : { ativo: true },
    order: [['nome', 'ASC']],
  });
}

export function buscarPorId(id: number) {
  return Categoria.findByPk(id);
}

export async function criar(dados: CamposCategoria & { nome: string }) {
  try {
    return await Categoria.create(dados);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function atualizar(categoria: Categoria, campos: CamposCategoria) {
  try {
    return await categoria.update(campos);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function excluir(categoria: Categoria) {
  return categoria.destroy();
}
