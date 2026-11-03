import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

const timeoutMs = () => Number(process.env.HTTP_TIMEOUT_MS ?? 5000);

interface Opcoes {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  // Só consultas (GET) devem ter mais de uma tentativa; POST de estoque não pode ser repetido.
  tentativas?: number;
}

export interface Resposta<T> {
  status: number;
  corpo: T | null;
}

// ADR-003: chamadas síncronas entre serviços precisam de timeout e retry.
// Falha de rede, timeout ou 5xx do outro serviço viram 503 aqui.
export async function chamar<T>(servico: string, url: string, opcoes: Opcoes = {}): Promise<Resposta<T>> {
  const { method = 'GET', headers = {}, body, tentativas = 1 } = opcoes;

  for (let tentativa = 1; ; tentativa++) {
    try {
      const resposta = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs()),
      });

      if (resposta.status >= 500) {
        if (tentativa < tentativas) continue;
        throw new ErroHttp(503, `${servico} indisponível no momento`);
      }

      let corpo: T | null = null;
      try {
        corpo = (await resposta.json()) as T;
      } catch {
        corpo = null;
      }
      return { status: resposta.status, corpo };
    } catch (err) {
      if (err instanceof ErroHttp) throw err;
      if (tentativa < tentativas) continue;
      logger.error({ servico, motivo: (err as Error).message }, 'falha ao chamar outro serviço');
      throw new ErroHttp(503, `${servico} indisponível no momento`);
    }
  }
}
