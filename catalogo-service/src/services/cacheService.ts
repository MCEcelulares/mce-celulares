import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { registrarCache } from '../utils/metricas';

const chaveVersao = 'catalogo:versao';
const ttlSegundos = () => Number(process.env.CACHE_TTL_SEGUNDOS ?? 300);

// Cache-aside: lê do Redis; no miss, carrega do banco e grava com TTL.
// Redis fora do ar nunca derruba a requisição: cai direto no banco (degradação graciosa).
export async function obterOuCarregar<T>(chave: string, carregar: () => Promise<T>): Promise<T> {
  let chaveCompleta: string | null = null;

  try {
    const versao = (await redis.get(chaveVersao)) ?? '0';
    chaveCompleta = `catalogo:v${versao}:${chave}`;
    const emCache = await redis.get(chaveCompleta);
    if (emCache) {
      registrarCache('hit');
      return JSON.parse(emCache) as T;
    }
    registrarCache('miss');
  } catch (err) {
    registrarCache('erro');
    logger.warn({ motivo: (err as Error).message }, 'cache indisponível: consultando o banco');
  }

  const valor = await carregar();

  if (chaveCompleta) {
    try {
      await redis.set(chaveCompleta, JSON.stringify(valor), 'EX', ttlSegundos());
    } catch (err) {
      logger.warn({ motivo: (err as Error).message }, 'cache indisponível: não foi possível gravar');
    }
  }
  return valor;
}

// Invalidação por versão: incrementar a versão deixa todas as chaves antigas órfãs (expiram pelo TTL),
// sem precisar de SCAN/DEL em massa.
export async function invalidarCatalogo(): Promise<void> {
  try {
    await redis.incr(chaveVersao);
  } catch (err) {
    logger.warn({ motivo: (err as Error).message }, 'cache indisponível: invalidação não aplicada (vale o TTL)');
  }
}
