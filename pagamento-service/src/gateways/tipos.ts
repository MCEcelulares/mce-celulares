export interface DadosCobranca {
  idPedido: number;
  valor: number;
  emailCliente: string;
  itens: { id: string; titulo: string; quantidade: number; precoUnitario: number }[];
  valorFrete: number;
  expiraEm: string | null;
}

export interface Cobranca {
  idExterno: string | null;
  urlPagamento: string | null;
  aprovadoNaHora: boolean;
}

export interface PagamentoExterno {
  id: string;
  status: string;
  externalReference: string | null;
  valor: number;
}

export interface GatewayPagamento {
  nome: string;
  iniciar(dados: DadosCobranca): Promise<Cobranca>;
  consultarPagamento(idExterno: string): Promise<PagamentoExterno | null>;
  buscarPagamentosPorReferencia(referencia: string): Promise<PagamentoExterno[]>;
}
