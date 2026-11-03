export interface DadosCobranca {
  idPedido: number;
  valor: number;
  emailCliente: string;
  itens: { id: string; titulo: string; quantidade: number; precoUnitario: number }[];
  valorFrete: number;
  // Até quando o pedido aceita pagamento (o Vendas cancela depois). null = sem prazo.
  expiraEm: string | null;
}

export interface Cobranca {
  idExterno: string | null;
  // Link para o cliente pagar (Checkout Pro). null quando o pagamento não passa por uma página externa.
  urlPagamento: string | null;
  // true = o gateway já aprovou o pagamento (só o gateway simulado faz isso).
  aprovadoNaHora: boolean;
}

export interface PagamentoExterno {
  status: string;
  externalReference: string | null;
  valor: number;
}

export interface GatewayPagamento {
  nome: string;
  iniciar(dados: DadosCobranca): Promise<Cobranca>;
  // Consulta um pagamento pelo id que veio no webhook. null = o gateway não conhece esse pagamento.
  consultarPagamento(idExterno: string): Promise<PagamentoExterno | null>;
  // Pagamentos feitos para um pedido (external_reference). Permite confirmar sem depender do webhook.
  buscarPagamentosPorReferencia(referencia: string): Promise<PagamentoExterno[]>;
}
