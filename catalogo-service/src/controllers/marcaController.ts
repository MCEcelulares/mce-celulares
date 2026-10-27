import { Request, Response, NextFunction } from 'express';
import * as marcaService from '../services/marcaService';

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await marcaService.listarMarcas());
  } catch (err) {
    next(err);
  }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await marcaService.criarMarca(req.body));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await marcaService.atualizarMarca(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}
