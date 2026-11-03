import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';
import { contextoRequisicao } from '../utils/contexto';

const caminho = (req: IncomingMessage) => ((req as Request).originalUrl ?? req.url ?? '').split('?')[0];

const logHttp = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const recebido = req.headers['x-correlation-id'];
    const id = typeof recebido === 'string' && recebido.length > 0 ? recebido : randomUUID();
    res.setHeader('x-correlation-id', id);
    return id;
  },
  customProps: (req) => ({ idCorrelacao: String(req.id) }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${caminho(req)} -> ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${caminho(req)} -> ${res.statusCode}`,
  serializers: {
    req: (req) => ({ method: req.method, url: caminho(req) }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

export function logarRequisicao(req: Request, res: Response, next: NextFunction) {
  logHttp(req, res, () => {
    contextoRequisicao.run({ idCorrelacao: String(req.id) }, next);
  });
}
