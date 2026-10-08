import { Request, Response, NextFunction } from 'express';
import * as enderecoService from '../services/enderecoService';

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const enderecos = await enderecoService.listarEnderecos(Number(req.params.id));
    res.status(200).json(enderecos);
  } catch (err) {
    next(err);
  }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const endereco = await enderecoService.criarEndereco(Number(req.params.id), req.body);
    res.status(201).json(endereco);
  } catch (err) {
    next(err);
  }
}

export async function marcarPrincipal(req: Request, res: Response, next: NextFunction) {
  try {
    const endereco = await enderecoService.marcarEnderecoPrincipal(
      Number(req.params.id),
      Number(req.params.idEndereco)
    );
    res.status(200).json(endereco);
  } catch (err) {
    next(err);
  }
}
