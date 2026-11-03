import { Request, Response, NextFunction } from 'express';
import { autenticar, AuthRequest } from './authMiddleware';
import { exigirPermissao } from './permissaoMiddleware';

// ?incluirInativos=true (painel) mostra itens inativos e exige catalogo:gerenciar.
// Sem o parâmetro a rota continua pública.
export function exigirGestorParaInativos(req: Request, res: Response, next: NextFunction) {
  if (req.query.incluirInativos !== 'true') return next();

  autenticar(req as AuthRequest, res, (erro?: unknown) => {
    if (erro) return next(erro);
    return exigirPermissao('catalogo:gerenciar')(req as AuthRequest, res, next);
  });
}
