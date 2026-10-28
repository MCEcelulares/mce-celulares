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

export type ResultadoBaixa = 'ok' | 'insuficiente' | 'inexistente';

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

export async function baixarEstoque(id: number, quantidade: number): Promise<ResultadoBaixa> {
  const r = await chamar<unknown>(SERVICO, `${base()}/produtos/${id}/estoque/baixa`, {
    method: 'POST',
    headers: cabecalhoServico(),
    body: { quantidade },
  });
  if (r.status === 200) return 'ok';
  if (r.status === 409) return 'insuficiente';
  if (r.status === 404) return 'inexistente';
  throw new ErroHttp(502, 'Não foi possível reservar o estoque no Catálogo');
}

export async function reporEstoque(id: number, quantidade: number): Promise<void> {
  const r = await chamar<unknown>(SERVICO, `${base()}/produtos/${id}/estoque/reposicao`, {
    method: 'POST',
    headers: cabecalhoServico(),
    body: { quantidade },
  });
  if (r.status !== 200) throw new ErroHttp(502, 'Não foi possível devolver o estoque ao Catálogo');
}
