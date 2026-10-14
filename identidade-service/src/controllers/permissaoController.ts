import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as permissaoService from "../services/permissaoService";

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await permissaoService.listarPermissoes());
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await permissaoService.buscarPermissao(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function criar(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res
      .status(201)
      .json(
        await permissaoService.criarPermissao(
          req.body.nome,
          req.usuarioAutenticado!.id_usuario,
        ),
      );
  } catch (err) {
    next(err);
  }
}

export async function renomear(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const permissao = await permissaoService.renomearPermissao(
      Number(req.params.id),
      req.body.nome,
      req.usuarioAutenticado!.id_usuario,
    );
    res.status(200).json(permissao);
  } catch (err) {
    next(err);
  }
}

export async function excluir(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await permissaoService.excluirPermissao(
      Number(req.params.id),
      req.usuarioAutenticado!.id_usuario,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
