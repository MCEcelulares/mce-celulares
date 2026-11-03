import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { logger } from '../utils/logger';
import { tamanhoMaximoImagem } from '../config/catalogo';

export class ErroHttp extends Error {
  status: number;
  detalhes?: unknown;
  constructor(status: number, message: string, detalhes?: unknown) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErroHttp) {
    logger.warn({ status: err.status, motivo: err.message }, 'erro de negócio');
    return res.status(err.status).json(err.detalhes ? { erro: err.message, detalhes: err.detalhes } : { erro: err.message });
  }

  if (err instanceof MulterError) {
    logger.warn({ codigo: err.code, motivo: err.message }, 'erro no upload');
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ erro: `Imagem maior que ${tamanhoMaximoImagem / 1024 / 1024} MB` });
    }
    return res.status(400).json({ erro: 'Upload inválido. Envie um único arquivo no campo "imagem"' });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn({ motivo: err.message }, 'JSON inválido no corpo da requisição');
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }

  logger.error({ err }, 'erro não tratado');
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}
