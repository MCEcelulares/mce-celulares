import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as cargoService from '../services/cargoService';

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await cargoService.listarCargos());
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await cargoService.buscarCargo(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function criar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await cargoService.criarCargo(req.body, req.usuarioAutenticado!.id_usuario));
  } catch (err) {
    next(err);
  }
}

export async function renomear(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cargo = await cargoService.renomearCargo(Number(req.params.id), req.body.nome, req.usuarioAutenticado!.id_usuario);
    res.status(200).json(cargo);
  } catch (err) {
    next(err);
  }
}

export async function excluir(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await cargoService.excluirCargo(Number(req.params.id), req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function definirPermissoes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cargo = await cargoService.definirPermissoesDoCargo(
      Number(req.params.id),
      req.body.permissoes,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(cargo);
  } catch (err) {
    next(err);
  }
}
