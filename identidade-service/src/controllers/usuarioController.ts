import { Request, Response, NextFunction } from 'express';
import * as usuarioService from '../services/usuarioService';

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await usuarioService.criarUsuario(req.body);
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await usuarioService.buscarUsuarioPorId(Number(req.params.id));
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
}
