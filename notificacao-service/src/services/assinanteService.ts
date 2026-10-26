import { redisAssinante } from '../config/redis';
import { contextoRequisicao } from '../utils/contexto';
import { registrarEvento } from '../utils/metricas';
import { logger } from '../utils/logger';
import {
  envelopeSchema,
  pedidoCriadoSchema,
  pagamentoConfirmadoSchema,
} from '../validators/eventoValidators';
import { processarPedidoCriado, processarPagamentoConfirmado } from './notificacaoService';

export const CANAIS = ['pedido.criado', 'pagamento.confirmado'] as const;
const VERSAO_SUPORTADA = 1;

function descartar(motivo: string, canal: string) {
  registrarEvento('evento_invalido');
  logger.warn({ canal, motivo }, 'evento descartado');
}

export async function tratarMensagem(canal: string, mensagem: string): Promise<void> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(mensagem);
  } catch {
    return descartar('JSON inválido', canal);
  }

  const envelope = envelopeSchema.safeParse(bruto);
  if (!envelope.success) return descartar('envelope fora do contrato', canal);
  if (envelope.data.tipo !== canal) return descartar('tipo diferente do canal', canal);
  if (envelope.data.versao !== VERSAO_SUPORTADA) {
    return descartar(`versão ${envelope.data.versao} não suportada`, canal);
  }

  const { id, ocorridoEm, dados } = envelope.data;

  await contextoRequisicao.run({ idCorrelacao: id }, async () => {
    if (canal === 'pedido.criado') {
      const parsed = pedidoCriadoSchema.safeParse(dados);
      if (!parsed.success) return descartar('dados fora do contrato', canal);
      await processarPedidoCriado(parsed.data, ocorridoEm);
    } else if (canal === 'pagamento.confirmado') {
      const parsed = pagamentoConfirmadoSchema.safeParse(dados);
      if (!parsed.success) return descartar('dados fora do contrato', canal);
      await processarPagamentoConfirmado(parsed.data, ocorridoEm);
    }
  });
}

export async function iniciarAssinante(): Promise<void> {
  redisAssinante.on('message', (canal, mensagem) => {
    tratarMensagem(canal, mensagem).catch((err) => logger.error({ err, canal }, 'falha ao processar evento'));
  });
  await redisAssinante.subscribe(...CANAIS);
  logger.info({ canais: CANAIS }, 'assinando canais de eventos');
}
