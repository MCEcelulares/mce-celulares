import { Request, Response, NextFunction } from 'express';
import * as categoriaService from '../services/categoriaService';

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await categoriaService.listarCategorias());
  } catch (err) {
    next(err);
  }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await categoriaService.criarCategoria(req.body));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await categoriaService.atualizarCategoria(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}
