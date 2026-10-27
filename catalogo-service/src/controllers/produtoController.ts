import { Request, Response, NextFunction } from 'express';
import * as produtoService from '../services/produtoService';

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.listarProdutos(req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function destaque(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.listarDestaques(Number(req.query.limite)));
  } catch (err) {
    next(err);
  }
}

export async function recentes(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.listarRecentes(Number(req.query.limite)));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.buscarProduto(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await produtoService.criarProduto(req.body));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.atualizarProduto(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function baixarEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.baixarEstoque(Number(req.params.id), req.body.quantidade));
  } catch (err) {
    next(err);
  }
}
