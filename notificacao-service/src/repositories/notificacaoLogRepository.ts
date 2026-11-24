import { Op, UniqueConstraintError } from 'sequelize';
import { NotificacaoLog } from '../models';
import { RegistroDuplicadoError } from './erros';

export interface NovoLog {
  id_pedido: number;
  tipo: string;
  destinatario: string;
  assunto: string;
  texto: string;
  status: string;
}

export type CamposLog = Partial<
  Pick<
    NotificacaoLog,
    'status' | 'erro' | 'destinatario' | 'assunto' | 'texto' | 'tentativas' | 'enviado_em' | 'criado_em'
  >
>;

export interface FiltroReenvio {
  maximoDeRodadas: number;
  limite: number;
}

export async function criar(dados: NovoLog) {
  try {
    return await NotificacaoLog.create(dados);
  } catch (err) {
    throw err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
  }
}

export function buscarPorPedidoETipo(idPedido: number, tipo: string) {
  return NotificacaoLog.findOne({ where: { id_pedido: idPedido, tipo } });
}

export function atualizar(log: NotificacaoLog, campos: CamposLog) {
  return log.update(campos);
}

export function buscarReenviaveis({ maximoDeRodadas, limite }: FiltroReenvio) {
  return NotificacaoLog.findAll({
    where: {
      status: { [Op.in]: ['FALHA', 'PENDENTE'] },
      tentativas: { [Op.lt]: maximoDeRodadas },
      assunto: { [Op.ne]: null },
      texto: { [Op.ne]: null },
    },
    order: [['criado_em', 'ASC']],
    limit: limite,
  });
}

export async function reivindicarReenvio(log: NotificacaoLog, agora: Date) {
  const [reivindicadas] = await NotificacaoLog.update(
    { status: 'PENDENTE', erro: null, criado_em: agora },
    { where: { id_notificacao: log.id_notificacao, status: log.status, criado_em: log.criado_em } }
  );
  return reivindicadas > 0;
}

export function listarPorPedido(idPedido: number) {
  return NotificacaoLog.findAll({
    where: { id_pedido: idPedido },
    attributes: { exclude: ['texto'] },
    order: [['id_notificacao', 'ASC']],
  });
}
