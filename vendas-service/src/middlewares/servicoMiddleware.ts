import { Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthRequest, autenticar } from './authMiddleware';

export interface ServicoRequest extends AuthRequest {
  chamadaDeServico?: boolean;
}

function tokenDeServicoValido(header?: string): boolean {
  const esperado = process.env.SERVICE_TOKEN;
  if (!esperado || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice('Bearer '.length));
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Rotas que o Pagamento chama (token de serviço) e que também têm uso administrativo (JWT + permissão).
export function autenticarOuServico(req: ServicoRequest, res: Response, next: NextFunction) {
  if (tokenDeServicoValido(req.headers.authorization)) {
    req.chamadaDeServico = true;
    return next();
  }
  return autenticar(req, res, next);
}
