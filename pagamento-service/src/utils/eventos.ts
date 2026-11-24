import { randomUUID } from 'crypto';
import { redis } from '../config/redis';
import { registrarEvento } from './metricas';
import { logger } from './logger';
import { contextoRequisicao } from './contexto';

export interface PagamentoConfirmadoDados {
  idPedido: number;
  valor: number;
  metodoPagamento: string;
  cliente: { nome: string; email: string };
}

export async function publicarPagamentoConfirmado(dados: PagamentoConfirmadoDados): Promise<void> {
  const tipo = 'pagamento.confirmado';
  const envelope = {
    id: randomUUID(),
    tipo,
    versao: 1,
    origem: 'pagamento-service',
    ocorridoEm: new Date().toISOString(),
    idCorrelacao: contextoRequisicao.getStore()?.idCorrelacao,
    dados,
  };
  try {
    const receptores = await redis.publish(tipo, JSON.stringify(envelope));
    logger.info({ idEvento: envelope.id, tipo, idPedido: dados.idPedido, receptores }, 'evento publicado');
  } catch (err) {
    registrarEvento('evento_nao_publicado');
    logger.error({ err, idPedido: dados.idPedido, tipo }, 'falha ao publicar evento');
  }
}
