import { randomUUID } from 'crypto';
import { redis } from '../config/redis';
import { registrarEvento } from './metricas';
import { logger } from './logger';

export interface PedidoCriadoDados {
  idPedido: number;
  status: string;
  valorTotal: number;
  cliente: { nome: string; email: string };
}

// Contrato do ADR-008: envelope comum + dados mínimos. Redis Pub/Sub não guarda mensagens;
// se a publicação falhar o pedido continua válido (o e-mail se perde, aceito no MVP).
export async function publicarPedidoCriado(dados: PedidoCriadoDados): Promise<void> {
  const tipo = 'pedido.criado';
  const envelope = {
    id: randomUUID(),
    tipo,
    versao: 1,
    origem: 'vendas-service',
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
