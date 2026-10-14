import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as authService from '../services/authService';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await authService.login(req.body));
  } catch (err) {
    next(err);
  }
}

export async function loginGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await authService.loginGoogle(req.body.idToken));
  } catch (err) {
    next(err);
  }
}

export async function renovar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await authService.renovarSessao(req.body.refreshToken));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.encerrarSessao(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function logoutTodos(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.encerrarTodasAsSessoes(req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
