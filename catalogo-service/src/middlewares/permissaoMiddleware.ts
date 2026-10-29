import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { logger } from '../utils/logger';

export function exigirPermissao(...permissoes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const temAlguma = permissoes.some((p) => req.usuarioAutenticado?.permissoes.includes(p));
    if (!temAlguma) {
      logger.warn(
        { id_usuario: req.usuarioAutenticado?.id_usuario, permissoes },
        'acesso negado: permissão ausente'
      );
      return res.status(403).json({ erro: 'Sem permissão para esta ação' });
    }
    next();
  };
}

export function temPermissao(req: AuthRequest, permissao: string): boolean {
  return req.usuarioAutenticado?.permissoes.includes(permissao) ?? false;
}
