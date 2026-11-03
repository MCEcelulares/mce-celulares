import { Request, Response, NextFunction } from 'express';
import * as notificacaoService from '../services/notificacaoService';

export async function listarPorPedido(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await notificacaoService.listarPorPedido(Number(req.params.idPedido)));
  } catch (err) {
    next(err);
  }
}
