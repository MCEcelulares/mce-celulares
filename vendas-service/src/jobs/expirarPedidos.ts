import {
  expirarPedido,
  idsDosPedidosInvisiveisAntigos,
  idsDosPedidosVencidos,
  minutosParaExpirar,
  recuperarPedidoOrfao,
} from '../services/pedidoService';
import { logger } from '../utils/logger';

export async function expirarPedidosVencidos(agora = new Date()): Promise<number> {
  const minutos = minutosParaExpirar();
  if (!(minutos > 0)) return 0;

  const vencidos = await idsDosPedidosVencidos(agora);

  let expirados = 0;
  for (const idPedido of vencidos) {
    try {
      if (await expirarPedido(idPedido)) expirados++;
    } catch (err) {
      logger.error({ err, idPedido }, 'falha ao expirar pedido');
    }
  }
  return expirados;
}

export async function recuperarPedidosOrfaos(agora = new Date()): Promise<number> {
  const orfaos = await idsDosPedidosInvisiveisAntigos(agora);

  let recuperados = 0;
  for (const idPedido of orfaos) {
    try {
      if (await recuperarPedidoOrfao(idPedido)) recuperados++;
    } catch (err) {
      logger.error({ err, idPedido }, 'falha ao recuperar pedido órfão (tenta de novo na próxima rodada)');
    }
  }
  return recuperados;
}

export function iniciarExpiracaoDePedidos(): NodeJS.Timeout | null {
  if (!(minutosParaExpirar() > 0)) {
    logger.info('expiração de pedidos desligada (PEDIDO_EXPIRA_MINUTOS=0); a recuperação de órfãos continua ligada');
  } else {
    logger.info({ minutos: minutosParaExpirar() }, 'expiração de pedidos não pagos ligada');
  }
  const intervaloMs = Number(process.env.PEDIDO_EXPIRA_VERIFICAR_SEGUNDOS ?? 60) * 1000;

  const timer = setInterval(() => {
    expirarPedidosVencidos().catch((err) => logger.error({ err }, 'falha na rotina de expiração de pedidos'));
    recuperarPedidosOrfaos().catch((err) => logger.error({ err }, 'falha na rotina de recuperação de pedidos órfãos'));
  }, intervaloMs);
  timer.unref();
  return timer;
}
