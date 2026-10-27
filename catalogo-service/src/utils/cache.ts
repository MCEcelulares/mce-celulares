import { redis } from '../config/redis';
import { registrarEvento } from './metricas';
import { logger } from './logger';

const ttlSegundos = () => Number(process.env.CACHE_TTL_SEGUNDOS ?? 300);

// O Redis é só um acelerador: se ele cair, o serviço continua lendo direto do banco.
export async function lerCache<T>(chave: string): Promise<T | null> {
  try {
    const valor = await redis.get(chave);
    registrarEvento(valor ? 'cache_hit' : 'cache_miss');
    return valor ? (JSON.parse(valor) as T) : null;
  } catch (err) {
    logger.warn({ chave, motivo: (err as Error).message }, 'cache indisponível (leitura)');
    return null;
  }
}

export async function gravarCache(chave: string, valor: unknown): Promise<void> {
  try {
    await redis.set(chave, JSON.stringify(valor), 'EX', ttlSegundos());
  } catch (err) {
    logger.warn({ chave, motivo: (err as Error).message }, 'cache indisponível (escrita)');
  }
}

export async function apagarCache(chave: string): Promise<void> {
  try {
    await redis.del(chave);
  } catch (err) {
    logger.warn({ chave, motivo: (err as Error).message }, 'cache indisponível (invalidação)');
  }
}
