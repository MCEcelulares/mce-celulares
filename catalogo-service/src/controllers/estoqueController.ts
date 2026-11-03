import { Request, Response, NextFunction } from 'express';
import * as estoqueService from '../services/estoqueService';
import * as produtoService from '../services/produtoService';

export async function reservar(req: Request, res: Response, next: NextFunction) {
  try {
    const { criada, reserva } = await estoqueService.reservarEstoque(req.body);
    res.status(criada ? 201 : 200).json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function devolver(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await estoqueService.devolverReserva(Number(req.params.idPedido)));
  } catch (err) {
    next(err);
  }
}

export async function buscarReserva(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await estoqueService.buscarReserva(Number(req.params.idPedido)));
  } catch (err) {
    next(err);
  }
}

export async function consultarProdutos(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.consultarProdutosInterno(req.query.ids as unknown as number[]));
  } catch (err) {
    next(err);
  }
}
