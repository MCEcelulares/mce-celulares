import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

// Rotas chamadas só por outros serviços (ex.: Vendas baixando estoque).
// Sem SERVICE_TOKEN configurado a rota fica desligada (404), como o /metrics.
export function exigirTokenServico(req: Request, res: Response, next: NextFunction) {
  const esperado = process.env.SERVICE_TOKEN;
  if (!esperado) {
    return res.status(404).json({ erro: 'Rota não encontrada' });
  }

  const header = req.headers.authorization ?? '';
  const recebido = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ erro: 'Token de serviço inválido' });
  }
  next();
}
