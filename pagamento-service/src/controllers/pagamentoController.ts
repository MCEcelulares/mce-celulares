import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as pagamentoService from '../services/pagamentoService';

export async function registrar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await pagamentoService.registrarPagamento(req.usuarioAutenticado!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await pagamentoService.buscarPagamento(req.usuarioAutenticado!, Number(req.params.idPedido)));
  } catch (err) {
    next(err);
  }
}

export async function sincronizar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await pagamentoService.sincronizarPagamento(req.usuarioAutenticado!, Number(req.params.idPedido)));
  } catch (err) {
    next(err);
  }
}

// Webhook do Mercado Pago: POST com { type: "payment", data: { id } } (o id também pode vir em ?data.id=).
// Responde 200 quando processou ou não precisa processar; qualquer erro vira 5xx para o Mercado Pago tentar de novo.
export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    const tipo = req.body?.type ?? req.query.type;
    const id = req.body?.data?.id ?? req.query['data.id'];
    if (tipo !== 'payment' || (typeof id !== 'string' && typeof id !== 'number')) {
      return res.status(200).json({ ignorado: true });
    }
    await pagamentoService.processarNotificacao(String(id));
    return res.status(200).json({ recebido: true });
  } catch (err) {
    return next(err);
  }
}
