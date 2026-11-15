import { UniqueConstraintError } from 'sequelize';
import { Marca } from '../models';
import { RegistroDuplicadoError } from './erros';

export type CamposMarca = Partial<Pick<Marca, 'nome' | 'ativo'>>;

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function listar(verInativos: boolean) {
  return Marca.findAll({
    where: verInativos ? {} : { ativo: true },
    order: [['nome', 'ASC']],
  });
}

export function buscarPorId(id: number) {
  return Marca.findByPk(id);
}

export async function criar(dados: CamposMarca & { nome: string }) {
  try {
    return await Marca.create(dados);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function atualizar(marca: Marca, campos: CamposMarca) {
  try {
    return await marca.update(campos);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function excluir(marca: Marca) {
  return marca.destroy();
}
