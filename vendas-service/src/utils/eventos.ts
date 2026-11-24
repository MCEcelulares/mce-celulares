import { randomUUID } from 'crypto';
import { redis } from '../config/redis';
import { registrarEvento } from './metricas';
import { logger } from './logger';
import { contextoRequisicao } from './contexto';

export interface PedidoCriadoDados {
  idPedido: number;
  status: string;
  valorTotal: number;
  cliente: { nome: string; email: string };
}

export async function publicarPedidoCriado(dados: PedidoCriadoDados): Promise<void> {
  const tipo = 'pedido.criado';
  const envelope = {
    id: randomUUID(),
    tipo,
    versao: 1,
    origem: 'vendas-service',
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
