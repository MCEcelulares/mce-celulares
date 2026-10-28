import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as carrinhoService from '../services/carrinhoService';

export async function buscar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await carrinhoService.buscarCarrinho(req.usuarioAutenticado!.id_usuario));
  } catch (err) {
    next(err);
  }
}

export async function adicionarItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { idProduto, quantidade } = req.body;
    res.status(201).json(await carrinhoService.adicionarItem(req.usuarioAutenticado!.id_usuario, idProduto, quantidade));
  } catch (err) {
    next(err);
  }
}

export async function atualizarItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const carrinho = await carrinhoService.atualizarItem(
      req.usuarioAutenticado!.id_usuario,
      Number(req.params.id),
      req.body.quantidade
    );
    res.status(200).json(carrinho);
  } catch (err) {
    next(err);
  }
}

export async function removerItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await carrinhoService.removerItem(req.usuarioAutenticado!.id_usuario, Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
