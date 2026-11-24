import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { registrarCache } from '../utils/metricas';

const chaveVersao = 'catalogo:versao';
const ttlSegundos = () => Number(process.env.CACHE_TTL_SEGUNDOS ?? 300);

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

export async function invalidarCatalogo(): Promise<void> {
  try {
    await redis.incr(chaveVersao);
  } catch (err) {
    logger.warn({ motivo: (err as Error).message }, 'cache indisponível: invalidação não aplicada (vale o TTL)');
  }
}
