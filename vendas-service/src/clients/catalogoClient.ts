import { chamar } from './http';
import { ErroHttp } from '../middlewares/errorHandler';

const SERVICO = 'Catálogo';
const base = () => process.env.CATALOGO_SERVICE_URL ?? 'http://catalogo:3002';

export interface ProdutoCatalogo {
  id_produto: number;
  nome: string;
  preco: number;
  estoque: number;
  ativo: boolean;
}

export interface ItemReserva {
  id_produto: number;
  quantidade: number;
}

export interface FaltaDeEstoque {
  id_produto: number;
  solicitado: number;
  disponivel: number;
}

// ok = reservado (ou já estava reservado para este pedido); sem_estoque = o Catálogo não reservou nada;
// recusada = outro 4xx do Catálogo (produto inexistente ou inativo, reserva já devolvida, reserva diferente...).
export type ResultadoReserva =
  | { tipo: 'ok' }
  | { tipo: 'sem_estoque'; faltas: FaltaDeEstoque[] }
  | { tipo: 'recusada'; status: number; mensagem: string };

function cabecalhoServico() {
  const token = process.env.CATALOGO_SERVICE_TOKEN;
  if (!token) throw new ErroHttp(503, 'Integração com o Catálogo não configurada');
  return { Authorization: `Bearer ${token}` };
}

// null = o Catálogo respondeu 404 (produto não existe ou está inativo).
export async function buscarProduto(id: number): Promise<ProdutoCatalogo | null> {
  const r = await chamar<ProdutoCatalogo>(SERVICO, `${base()}/produtos/${id}`, { tentativas: 2 });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.corpo) throw new ErroHttp(502, 'Resposta inesperada do Catálogo');
  return r.corpo;
}

// Reserva todos os itens do pedido de uma vez (tudo ou nada). Idempotente por pedido, por isso pode ser repetida.
export async function reservarEstoque(idPedido: number, itens: ItemReserva[]): Promise<ResultadoReserva> {
  const r = await chamar<{ erro?: string; detalhes?: FaltaDeEstoque[] }>(SERVICO, `${base()}/interno/reservas`, {
    method: 'POST',
    headers: cabecalhoServico(),
    body: { id_pedido: idPedido, itens },
    tentativas: 2,
  });
  if (r.status === 200 || r.status === 201) return { tipo: 'ok' };
  if (r.status === 409 && r.corpo?.erro === 'Estoque insuficiente' && Array.isArray(r.corpo.detalhes)) {
    return { tipo: 'sem_estoque', faltas: r.corpo.detalhes };
  }
  if (r.status === 404 || r.status === 409) {
    return { tipo: 'recusada', status: r.status, mensagem: r.corpo?.erro ?? 'Reserva recusada pelo Catálogo' };
  }
  throw new ErroHttp(502, 'Não foi possível reservar o estoque no Catálogo');
}

// Devolve ao estoque a reserva do pedido. Idempotente. 404 = não havia reserva (nada a devolver).
export async function devolverReserva(idPedido: number): Promise<void> {
  const r = await chamar<unknown>(SERVICO, `${base()}/interno/reservas/${idPedido}/devolucao`, {
    method: 'POST',
    headers: cabecalhoServico(),
    tentativas: 2,
  });
  if (r.status === 200 || r.status === 404) return;
  throw new ErroHttp(502, 'Não foi possível devolver o estoque ao Catálogo');
}
