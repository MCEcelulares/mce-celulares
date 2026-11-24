import { GatewayPagamento } from './tipos';

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
