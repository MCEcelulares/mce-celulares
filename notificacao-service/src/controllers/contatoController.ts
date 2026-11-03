import { Request, Response, NextFunction } from 'express';
import * as contatoService from '../services/contatoService';

export async function enviar(req: Request, res: Response, next: NextFunction) {
  try {
    await contatoService.enviarContato(req.body);
    res.status(202).json({ mensagem: 'Mensagem recebida e enviada com sucesso' });
  } catch (err) {
    next(err);
  }
}
