import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as usuarioService from '../services/usuarioService';

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await usuarioService.criarUsuario(req.body));
  } catch (err) {
    next(err);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await usuarioService.listarUsuarios(req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await usuarioService.buscarUsuarioPorId(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await usuarioService.buscarUsuarioPorId(req.usuarioAutenticado!.id_usuario));
  } catch (err) {
    next(err);
  }
}

export async function atualizarPerfil(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await usuarioService.atualizarPerfil(req.usuarioAutenticado!.id_usuario, req.body));
  } catch (err) {
    next(err);
  }
}

export async function atualizarComoAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const usuario = await usuarioService.atualizarUsuarioComoAdmin(
      Number(req.params.id),
      req.body,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function alterarStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const usuario = await usuarioService.alterarStatus(
      Number(req.params.id),
      req.body.ativo,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function excluir(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await usuarioService.excluirUsuario(Number(req.params.id), req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function alterarSenha(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await usuarioService.alterarSenha(req.usuarioAutenticado!.id_usuario, req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function definirCargos(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const perfil = await usuarioService.definirCargos(
      Number(req.params.id),
      req.body.cargos,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(perfil);
  } catch (err) {
    next(err);
  }
}
