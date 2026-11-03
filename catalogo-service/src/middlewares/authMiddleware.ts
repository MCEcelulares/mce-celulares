import { Request, Response, NextFunction } from 'express';
import { validarToken, TokenPayload } from '../utils/jwt';

export interface AuthRequest extends Request {
  usuarioAutenticado?: TokenPayload;
}

function lerToken(req: Request): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const payload = validarToken(header.slice('Bearer '.length));
    return { ...payload, cargos: payload.cargos ?? [], permissoes: payload.permissoes ?? [] };
  } catch {
    return null;
  }
}

export function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não enviado' });
  }

  const payload = lerToken(req);
  if (!payload) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
  req.usuarioAutenticado = payload;
  next();
}

// Rotas públicas (vitrine): com token válido o usuário ganha visão de gestão; token ausente ou expirado = visitante.
export function autenticarOpcional(req: AuthRequest, _res: Response, next: NextFunction) {
  const payload = lerToken(req);
  if (payload) req.usuarioAutenticado = payload;
  next();
}
