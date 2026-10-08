import { Request, Response, NextFunction } from 'express';

export class ErroHttp extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErroHttp) {
    return res.status(err.status).json({ erro: err.message });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}
