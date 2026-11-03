import Redis from 'ioredis';
import 'dotenv/config';
import { logger } from '../utils/logger';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  commandTimeout: 2000,
  enableOfflineQueue: false,
  retryStrategy: (tentativa) => Math.min(tentativa * 500, 5000),
});

redis.on('error', (err) => logger.warn({ motivo: err.message }, 'redis: erro de conexão'));
redis.on('ready', () => logger.info('redis: conectado'));

export async function redisDisponivel(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function aguardarRedis(timeoutMs = 3000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    if (await redisDisponivel()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  logger.warn('redis indisponível na inicialização — o serviço sobe, mas não publica eventos até ele voltar');
}
