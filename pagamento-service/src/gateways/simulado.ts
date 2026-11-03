import { GatewayPagamento } from './tipos';

// Só para desenvolvimento e testes: aprova na hora, sem cobrar ninguém.
// É preciso pedir explicitamente com GATEWAY_PAGAMENTO=simulado.
export const gatewaySimulado: GatewayPagamento = {
  nome: 'simulado',
  async iniciar() {
    return { idExterno: null, urlPagamento: null, aprovadoNaHora: true };
  },
  async consultarPagamento() {
    return null;
  },
  async buscarPagamentosPorReferencia() {
    return [];
  },
};
