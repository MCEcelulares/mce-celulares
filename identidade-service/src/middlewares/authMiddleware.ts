import { Request, Response, NextFunction } from 'express';
import { validarToken, TokenPayload } from '../utils/jwt';

export interface AuthRequest extends Request {
  usuarioAutenticado?: TokenPayload;
}

export function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não enviado' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = validarToken(token);
    req.usuarioAutenticado = {
      ...payload,
      cargos: payload.cargos ?? [],
      permissoes: payload.permissoes ?? [],
    };
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
