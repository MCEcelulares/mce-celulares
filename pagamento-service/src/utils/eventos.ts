import { randomUUID } from 'crypto';
import { redis } from '../config/redis';
import { registrarEvento } from './metricas';
import { logger } from './logger';

export interface PagamentoConfirmadoDados {
  idPedido: number;
  valor: number;
  metodoPagamento: string;
  cliente: { nome: string; email: string };
}

// Contrato do ADR-008: envelope comum + dados mínimos. Redis Pub/Sub não guarda mensagens;
// se a publicação falhar o pagamento continua confirmado (o e-mail se perde, aceito no MVP).
export async function publicarPagamentoConfirmado(dados: PagamentoConfirmadoDados): Promise<void> {
  const tipo = 'pagamento.confirmado';
  const envelope = {
    id: randomUUID(),
    tipo,
    versao: 1,
    origem: 'pagamento-service',
    ocorridoEm: new Date().toISOString(),
    dados,
  };
  try {
    await redis.publish(tipo, JSON.stringify(envelope));
  } catch (err) {
    registrarEvento('evento_nao_publicado');
    logger.error({ err, idPedido: dados.idPedido, tipo }, 'falha ao publicar evento');
  }
}
