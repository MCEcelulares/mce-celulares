import { Op } from 'sequelize';
import { Pedido } from '../models';
import { expirarPedido, minutosParaExpirar } from '../services/pedidoService';
import { logger } from '../utils/logger';

// Cancela os pedidos AGUARDANDO_PAGAMENTO mais antigos que PEDIDO_EXPIRA_MINUTOS e devolve o estoque.
export async function expirarPedidosVencidos(agora = new Date()): Promise<number> {
  const minutos = minutosParaExpirar();
  if (!(minutos > 0)) return 0;

  const limite = new Date(agora.getTime() - minutos * 60_000);
  const vencidos = await Pedido.findAll({
    where: { status: 'AGUARDANDO_PAGAMENTO', ativo: true, data: { [Op.lt]: limite } },
    attributes: ['id_pedido'],
    order: [['data', 'ASC']],
    limit: 50,
  });

  let expirados = 0;
  for (const { id_pedido } of vencidos) {
    try {
      if (await expirarPedido(id_pedido)) expirados++;
    } catch (err) {
      logger.error({ err, idPedido: id_pedido }, 'falha ao expirar pedido');
    }
  }
  return expirados;
}

export function iniciarExpiracaoDePedidos(): NodeJS.Timeout | null {
  if (!(minutosParaExpirar() > 0)) {
    logger.info('expiração de pedidos desligada (PEDIDO_EXPIRA_MINUTOS=0)');
    return null;
  }
  const intervaloMs = Number(process.env.PEDIDO_EXPIRA_VERIFICAR_SEGUNDOS ?? 60) * 1000;
  logger.info({ minutos: minutosParaExpirar() }, 'expiração de pedidos não pagos ligada');

  const timer = setInterval(() => {
    expirarPedidosVencidos().catch((err) => logger.error({ err }, 'falha na rotina de expiração de pedidos'));
  }, intervaloMs);
  timer.unref();
  return timer;
}
