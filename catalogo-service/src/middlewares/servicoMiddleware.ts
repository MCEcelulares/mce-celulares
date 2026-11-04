import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';

function tokensIguais(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function autenticarServico(req: Request, res: Response, next: NextFunction) {
  const esperado = process.env.SERVICE_TOKEN;
  if (!esperado) {
    logger.error('SERVICE_TOKEN não configurado: rotas internas desativadas');
    return res.status(503).json({ erro: 'Rotas internas indisponíveis' });
  }

  const authorization = req.headers.authorization;
  const recebidoPorAuthorization = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;
  const recebido = recebidoPorAuthorization ?? req.headers['x-service-token'];
  if (typeof recebido !== 'string' || !tokensIguais(recebido, esperado)) {
    logger.warn('rota interna: token de serviço ausente ou inválido');
    return res.status(401).json({ erro: 'Token de serviço inválido' });
  }
  next();
}
