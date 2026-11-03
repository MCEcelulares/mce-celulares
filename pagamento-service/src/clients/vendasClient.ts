import { chamar } from './http';
import { ErroHttp } from '../middlewares/errorHandler';

const SERVICO = 'Vendas';
const base = () => process.env.VENDAS_SERVICE_URL ?? 'http://vendas:3003';

export interface PedidoVendas {
  id_pedido: number;
  status: string;
  valor_total: number;
  valor_frete: number;
  expira_em: string | null;
  itens: { id_produto: number | null; nome_produto: string; quantidade: number; preco_unitario: number }[];
  cliente: { id_usuario: number | null; nome: string; email: string; telefone: string } | null;
}

function cabecalhoServico() {
  const token = process.env.VENDAS_SERVICE_TOKEN;
  if (!token) throw new ErroHttp(503, 'Integração com o Vendas não configurada');
  return { Authorization: `Bearer ${token}` };
}

// null = o Vendas respondeu 404.
export async function buscarPedido(id: number): Promise<PedidoVendas | null> {
  const r = await chamar<PedidoVendas>(SERVICO, `${base()}/pedidos/${id}`, {
    headers: cabecalhoServico(),
    tentativas: 2,
  });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.corpo) throw new ErroHttp(502, 'Resposta inesperada do Vendas');
  return r.corpo;
}

// A resposta traz o cliente (nome e e-mail) usado no evento pagamento.confirmado.
// O Vendas aceita repetir o mesmo status, então esta chamada pode ser refeita sem efeito colateral.
export async function atualizarStatus(id: number, status: string): Promise<PedidoVendas> {
  const r = await chamar<PedidoVendas>(SERVICO, `${base()}/pedidos/${id}/status`, {
    method: 'PATCH',
    headers: cabecalhoServico(),
    body: { status },
    tentativas: 2,
  });
  if (r.status === 200 && r.corpo) return r.corpo;
  if (r.status === 404) throw new ErroHttp(404, 'Pedido não existe');
  if (r.status === 409) throw new ErroHttp(409, 'O pedido não pode mais receber este pagamento');
  throw new ErroHttp(502, 'Não foi possível atualizar o pedido no Vendas');
}
