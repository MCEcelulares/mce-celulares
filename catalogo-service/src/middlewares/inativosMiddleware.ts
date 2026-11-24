import { Request, Response, NextFunction } from 'express';
import { autenticar, AuthRequest } from './authMiddleware';
import { exigirPermissao } from './permissaoMiddleware';

export function exigirGestorParaInativos(req: Request, res: Response, next: NextFunction) {
  if (req.query.incluirInativos !== 'true') return next();

  autenticar(req as AuthRequest, res, (erro?: unknown) => {
    if (erro) return next(erro);
    return exigirPermissao('catalogo:gerenciar')(req as AuthRequest, res, next);
  });
}
