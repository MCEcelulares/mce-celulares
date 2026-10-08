import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await authService.login(req.body);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function loginGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await authService.loginGoogle(req.body.idToken);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
