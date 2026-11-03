import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class ErroHttp extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErroHttp) {
    logger.warn({ status: err.status, motivo: err.message }, 'erro de negócio');
    return res.status(err.status).json({ erro: err.message });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn({ motivo: err.message }, 'JSON inválido no corpo da requisição');
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }

  logger.error({ err }, 'erro não tratado');
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}
