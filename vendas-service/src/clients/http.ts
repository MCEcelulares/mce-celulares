import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';

const timeoutMs = () => Number(process.env.HTTP_TIMEOUT_MS ?? 5000);
// Espera entre tentativas: base, 2x base, 4x base... (200ms, 400ms, ...)
const backoffBaseMs = () => Number(process.env.HTTP_BACKOFF_BASE_MS ?? 200);
// Circuit breaker: depois de N chamadas seguidas que falharam o circuito abre e as chamadas são recusadas na hora;
// passado CIRCUIT_RESET_MS uma única chamada de teste passa (meio-aberto): se der certo o circuito fecha.
const falhasParaAbrir = () => Number(process.env.CIRCUIT_FALHAS ?? 5);
const esperaParaTestarMs = () => Number(process.env.CIRCUIT_RESET_MS ?? 10_000);

interface Opcoes {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  // Só chamadas idempotentes (GET, reserva e devolução por pedido) devem ter mais de uma tentativa.
  tentativas?: number;
}

export interface Resposta<T> {
  status: number;
  corpo: T | null;
}

interface Circuito {
  falhas: number;
  abertoEm: number | null;
  testando: boolean;
}

const circuitos = new Map<string, Circuito>();

function circuitoDe(servico: string): Circuito {
  let circuito = circuitos.get(servico);
  if (!circuito) {
    circuito = { falhas: 0, abertoEm: null, testando: false };
    circuitos.set(servico, circuito);
  }
  return circuito;
}

export function reiniciarCircuitos() {
  circuitos.clear();
}

export function estadoDoCircuito(servico: string): 'fechado' | 'aberto' | 'meio-aberto' {
  const circuito = circuitoDe(servico);
  if (circuito.abertoEm === null) return 'fechado';
  return circuito.testando ? 'meio-aberto' : 'aberto';
}

const indisponivel = (servico: string) => new ErroHttp(503, `${servico} indisponível no momento`);

function liberarChamada(servico: string) {
  const circuito = circuitoDe(servico);
  if (circuito.abertoEm === null) return;

  const decorrido = Date.now() - circuito.abertoEm;
  if (decorrido < esperaParaTestarMs() || circuito.testando) {
    registrarEvento('circuito_recusou_chamada');
    throw indisponivel(servico);
  }
  circuito.testando = true;
  logger.info({ servico }, 'circuit breaker meio-aberto: testando uma chamada');
}

function registrarSucesso(servico: string) {
  const circuito = circuitoDe(servico);
  if (circuito.abertoEm !== null) {
    registrarEvento('circuito_fechado');
    logger.info({ servico }, 'circuit breaker fechado: serviço respondeu');
  }
  circuito.falhas = 0;
  circuito.abertoEm = null;
  circuito.testando = false;
}

function registrarFalha(servico: string) {
  const circuito = circuitoDe(servico);
  circuito.falhas += 1;
  const reabrir = circuito.testando;
  circuito.testando = false;

  if (reabrir || (circuito.abertoEm === null && circuito.falhas >= falhasParaAbrir())) {
    circuito.abertoEm = Date.now();
    registrarEvento('circuito_aberto');
    logger.error({ servico, falhas: circuito.falhas }, 'circuit breaker aberto: chamadas recusadas por um tempo');
  }
}

const esperar = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

// ADR-003: chamadas síncronas entre serviços têm timeout, retry com backoff e circuit breaker.
// Falha de rede, timeout ou 5xx do outro serviço (depois das tentativas) viram 503 aqui.
// Resposta 4xx é resposta válida do outro serviço: não conta como falha para o circuito.
export async function chamar<T>(servico: string, url: string, opcoes: Opcoes = {}): Promise<Resposta<T>> {
  const { method = 'GET', headers = {}, body, tentativas = 1 } = opcoes;

  liberarChamada(servico);

  let motivo = '';
  for (let tentativa = 1; tentativa <= Math.max(1, tentativas); tentativa++) {
    if (tentativa > 1) await esperar(backoffBaseMs() * 2 ** (tentativa - 2));

    try {
      const resposta = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs()),
      });

      if (resposta.status >= 500) {
        motivo = `HTTP ${resposta.status}`;
        continue;
      }

      let corpo: T | null = null;
      try {
        corpo = (await resposta.json()) as T;
      } catch {
        corpo = null;
      }
      registrarSucesso(servico);
      return { status: resposta.status, corpo };
    } catch (err) {
      motivo = (err as Error).message;
    }
  }

  registrarFalha(servico);
  logger.error({ servico, motivo }, 'falha ao chamar outro serviço');
  throw indisponivel(servico);
}
