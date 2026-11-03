import Redis from 'ioredis';
import 'dotenv/config';
import { logger } from '../utils/logger';

export const redisAssinante = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  connectTimeout: 3000,
  retryStrategy: (tentativa) => Math.min(tentativa * 500, 5000),
});

redisAssinante.on('error', (err) => logger.warn({ motivo: err.message }, 'redis: erro de conexão'));
redisAssinante.on('ready', () => logger.info('redis: conectado'));

export function redisDisponivel(): boolean {
  return redisAssinante.status === 'ready';
}