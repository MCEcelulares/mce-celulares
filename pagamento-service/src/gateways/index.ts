import { ErroHttp } from '../middlewares/errorHandler';
import { criarGatewayMercadoPago } from './mercadoPago';
import { gatewaySimulado } from './simulado';
import { GatewayPagamento } from './tipos';

export function obterGateway(): GatewayPagamento {
  const tipo = process.env.GATEWAY_PAGAMENTO || 'mercadopago';

  if (tipo === 'simulado') return gatewaySimulado;

  if (tipo === 'mercadopago') {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new ErroHttp(503, 'Gateway de pagamento não configurado');
    return criarGatewayMercadoPago(token);
  }

  throw new ErroHttp(503, `GATEWAY_PAGAMENTO inválido: ${tipo}`);
}

export type { GatewayPagamento } from './tipos';
