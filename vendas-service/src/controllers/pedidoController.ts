import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ServicoRequest } from '../middlewares/servicoMiddleware';
import * as pedidoService from '../services/pedidoService';

export async function criar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const pedido = await pedidoService.criarPedido(
      req.usuarioAutenticado!,
      req.headers.authorization as string,
      req.body.idEndereco
    );
    res.status(201).json(pedido);
  } catch (err) {
    next(err);
  }
}

export async function listar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await pedidoService.listarPedidos(req.usuarioAutenticado!, req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await pedidoService.buscarPedido(req.usuarioAutenticado!, Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function atualizarStatus(req: ServicoRequest, res: Response, next: NextFunction) {
  try {
    const autor = req.chamadaDeServico
      ? ({ servico: true } as const)
      : ({ servico: false, usuario: req.usuarioAutenticado! } as const);
    res.status(200).json(await pedidoService.atualizarStatus(Number(req.params.id), req.body.status, autor));
  } catch (err) {
    next(err);
  }
}
