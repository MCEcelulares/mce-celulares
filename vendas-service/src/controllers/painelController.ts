import { Request, Response, NextFunction } from 'express';
import * as painelService from '../services/painelService';

export async function resumo(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await painelService.resumoDoPainel(Number(req.query.dias)));
  } catch (err) {
    next(err);
  }
}

export async function maisVendidos(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await painelService.maisVendidos(Number(req.query.limite)));
  } catch (err) {
    next(err);
  }
}
