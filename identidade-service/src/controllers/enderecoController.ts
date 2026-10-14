import { Request, Response, NextFunction } from 'express';
import * as enderecoService from '../services/enderecoService';

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await enderecoService.listarEnderecos(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: Request, res: Response, next: NextFunction) {
  try {
    const endereco = await enderecoService.buscarEndereco(Number(req.params.id), Number(req.params.idEndereco));
    res.status(200).json(endereco);
  } catch (err) {
    next(err);
  }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await enderecoService.criarEndereco(Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const endereco = await enderecoService.atualizarEndereco(
      Number(req.params.id),
      Number(req.params.idEndereco),
      req.body
    );
    res.status(200).json(endereco);
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

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await enderecoService.removerEndereco(Number(req.params.id), Number(req.params.idEndereco));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
