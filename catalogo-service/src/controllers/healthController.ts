import { Request, Response } from 'express';
import { sequelize } from '../config/database';
import { redisDisponivel } from '../config/redis';
import { registro } from '../utils/metricas';
import { logger } from '../utils/logger';

export function vivo(_req: Request, res: Response) {
  res.status(200).json({ status: 'ok', servico: 'catalogo-service' });
}

export async function pronto(_req: Request, res: Response) {
  let banco = 'ok';
  try {
    await sequelize.authenticate();
  } catch (err) {
    banco = 'falha';
    logger.error({ err }, 'healthcheck: banco indisponível');
  }
  const cache = (await redisDisponivel()) ? 'ok' : 'falha';

  if (banco === 'falha') {
    return res.status(503).json({ status: 'indisponivel', servico: 'catalogo-service', banco, redis: cache });
  }
  const status = cache === 'ok' ? 'ok' : 'degradado';
  return res.status(200).json({ status, servico: 'catalogo-service', banco, redis: cache });
}

export async function metricas(req: Request, res: Response) {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    return res.status(404).json({ erro: 'Rota não encontrada' });
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ erro: 'Token de métricas inválido' });
  }
  res.set('Content-Type', registro.contentType);
  return res.status(200).send(await registro.metrics());
}
