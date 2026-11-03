import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { temPermissao } from '../middlewares/permissaoMiddleware';
import { permissaoGerenciar } from '../config/catalogo';
import * as categoriaService from '../services/categoriaService';

const verInativos = (req: AuthRequest, quer = true) => quer && temPermissao(req, permissaoGerenciar);

export async function listar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const quer = (req.query as { incluirInativos?: boolean }).incluirInativos ?? false;
    res.status(200).json(await categoriaService.listarCategorias(verInativos(req, quer)));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await categoriaService.buscarCategoria(Number(req.params.id), verInativos(req)));
  } catch (err) {
    next(err);
  }
}

export async function criar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await categoriaService.criarCategoria(req.body, req.usuarioAutenticado!.id_usuario));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const categoria = await categoriaService.atualizarCategoria(
      Number(req.params.id),
      req.body,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(categoria);
  } catch (err) {
    next(err);
  }
}

export async function excluir(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await categoriaService.excluirCategoria(Number(req.params.id), req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
