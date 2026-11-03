import { chamar } from '../clients/http';
import { ErroHttp } from '../middlewares/errorHandler';
import { Cobranca, DadosCobranca, GatewayPagamento, PagamentoExterno } from './tipos';

const SERVICO = 'Mercado Pago';
const BASE = 'https://api.mercadopago.com';

interface RespostaPreferencia {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface RespostaPagamento {
  status: string;
  external_reference?: string | null;
  transaction_amount: number;
}

interface RespostaBusca {
  results?: RespostaPagamento[];
}

const paraPagamentoExterno = (p: RespostaPagamento): PagamentoExterno => ({
  status: p.status,
  externalReference: p.external_reference ?? null,
  valor: Number(p.transaction_amount),
});

// O Mercado Pago documenta as datas com deslocamento (ex.: -04:00); usamos +00:00 em vez de "Z".
const paraDataMercadoPago = (data: Date | string) => new Date(data).toISOString().replace('Z', '+00:00');

// Checkout Pro: criamos uma "preferência" com os itens do pedido (RF42) e o cliente paga na página do
// Mercado Pago. A confirmação chega pelo webhook, que consulta o pagamento na API do MP (nunca confiamos
// no conteúdo do webhook), ou por uma consulta direta (buscarPagamentosPorReferencia).
// Para testar, use as credenciais de teste do vendedor e um comprador de teste (ver o README do serviço).
export function criarGatewayMercadoPago(accessToken: string): GatewayPagamento {
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    nome: 'mercadopago',

    async iniciar(dados: DadosCobranca): Promise<Cobranca> {
      const itens = dados.itens.map((i) => ({
        id: i.id,
        title: i.titulo,
        quantity: i.quantidade,
        currency_id: 'BRL',
        unit_price: i.precoUnitario,
      }));
      if (dados.valorFrete > 0) {
        itens.push({ id: 'frete', title: 'Frete', quantity: 1, currency_id: 'BRL', unit_price: dados.valorFrete });
      }

      const urlPublica = process.env.PUBLIC_BASE_URL;
      const urlLoja = process.env.FRONTEND_URL;
      const preferencia = {
        items: itens,
        payer: { email: dados.emailCliente },
        external_reference: String(dados.idPedido),
        // O link para de aceitar pagamento quando o Vendas cancelaria o pedido por falta de pagamento.
        ...(dados.expiraEm && {
          expires: true,
          expiration_date_from: paraDataMercadoPago(new Date()),
          expiration_date_to: paraDataMercadoPago(dados.expiraEm),
        }),
        ...(urlPublica && { notification_url: `${urlPublica.replace(/\/$/, '')}/pagamentos/webhook` }),
        ...(urlLoja && {
          back_urls: {
            success: `${urlLoja.replace(/\/$/, '')}/pedidos/${dados.idPedido}`,
            pending: `${urlLoja.replace(/\/$/, '')}/pedidos/${dados.idPedido}`,
            failure: `${urlLoja.replace(/\/$/, '')}/pedidos/${dados.idPedido}`,
          },
          auto_return: 'approved',
        }),
      };

      const r = await chamar<RespostaPreferencia>(SERVICO, `${BASE}/checkout/preferences`, {
        method: 'POST',
        headers,
        body: preferencia,
      });
      if ((r.status !== 201 && r.status !== 200) || !r.corpo?.id) {
        throw new ErroHttp(502, 'O Mercado Pago recusou a criação do pagamento');
      }
      return {
        idExterno: r.corpo.id,
        urlPagamento: r.corpo.init_point ?? r.corpo.sandbox_init_point ?? null,
        aprovadoNaHora: false,
      };
    },

    async consultarPagamento(idExterno: string): Promise<PagamentoExterno | null> {
      const r = await chamar<RespostaPagamento>(SERVICO, `${BASE}/v1/payments/${encodeURIComponent(idExterno)}`, {
        headers,
        tentativas: 2,
      });
      if (r.status === 404) return null;
      if (r.status !== 200 || !r.corpo) throw new ErroHttp(502, 'Resposta inesperada do Mercado Pago');
      return paraPagamentoExterno(r.corpo);
    },

    async buscarPagamentosPorReferencia(referencia: string): Promise<PagamentoExterno[]> {
      const consulta = `external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc`;
      const r = await chamar<RespostaBusca>(SERVICO, `${BASE}/v1/payments/search?${consulta}`, {
        headers,
        tentativas: 2,
      });
      if (r.status !== 200 || !r.corpo) throw new ErroHttp(502, 'Resposta inesperada do Mercado Pago');
      return (r.corpo.results ?? []).map(paraPagamentoExterno);
    },
  };
}
