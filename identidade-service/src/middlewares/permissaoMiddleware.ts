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

export function donoOuPermissao(permissao?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const auth = req.usuarioAutenticado;
    const ehDono = auth?.id_usuario === Number(req.params.id);
    const temPermissao = permissao !== undefined && auth?.permissoes.includes(permissao);

    if (!ehDono && !temPermissao) {
      logger.warn(
        { id_usuario: auth?.id_usuario, recurso_de: req.params.id, permissao },
        'acesso negado: não é o dono do recurso'
      );
      return res.status(403).json({ erro: 'Sem permissão para acessar este recurso' });
    }
    next();
  };
}
