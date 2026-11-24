import { Op, UniqueConstraintError } from 'sequelize';
import { Pagamento } from '../models';
import { StatusPagamento } from '../models/statusPagamento';
import { RegistroDuplicadoError } from './erros';

export interface NovoPagamento {
  id_pedido: number;
  id_usuario: number;
  metodo_pagamento: string;
  valor: number;
  status: StatusPagamento;
}

export type CamposPagamento = Partial<
  Pick<Pagamento, 'metodo_pagamento' | 'valor' | 'status' | 'id_externo' | 'url_pagamento'>
>;

export interface FiltroListagem {
  status?: StatusPagamento;
  limite: number;
  pagina: number;
}

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function buscarPorPedido(idPedido: number) {
  return Pagamento.findOne({ where: { id_pedido: idPedido } });
}

export async function listar(filtro: FiltroListagem) {
  const { rows, count } = await Pagamento.findAndCountAll({
    where: filtro.status ? { status: filtro.status } : {},
    order: [['id_pagamento', 'DESC']],
    limit: filtro.limite,
    offset: (filtro.pagina - 1) * filtro.limite,
  });
  return { registros: rows, total: count };
}

export async function criar(dados: NovoPagamento) {
  try {
    return await Pagamento.create(dados);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function atualizar(pagamento: Pagamento, campos: CamposPagamento) {
  try {
    return await pagamento.update(campos);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function reivindicarAprovacao(idPagamento: number, idGateway: string | null) {
  const [alterados] = await Pagamento.update(
    { status: 'APROVADO', data_pagamento: new Date(), id_pagamento_gateway: idGateway },
    { where: { id_pagamento: idPagamento, status: { [Op.ne]: 'APROVADO' } } }
  );
  return alterados > 0;
}

export async function marcarParaReembolso(idPagamento: number, idGateway: string | null) {
  const [alterados] = await Pagamento.update(
    { status: 'REEMBOLSAR', id_pagamento_gateway: idGateway },
    { where: { id_pagamento: idPagamento, status: { [Op.ne]: 'APROVADO' } } }
  );
  return alterados > 0;
}
