import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { temPermissao } from '../middlewares/permissaoMiddleware';
import { ErroHttp } from '../middlewares/errorHandler';
import { permissaoGerenciar } from '../config/catalogo';
import * as produtoService from '../services/produtoService';
import { ListarProdutosQuery } from '../validators/produtoValidators';

const verInativos = (req: AuthRequest, quer: boolean | undefined = true) =>
  quer && temPermissao(req, permissaoGerenciar);

export async function listar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filtros = req.query as unknown as ListarProdutosQuery;
    res.status(200).json(await produtoService.listarProdutos(filtros, verInativos(req, filtros.incluirInativos ?? false)));
  } catch (err) {
    next(err);
  }
}

export async function destaques(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.listarDestaques(Number(req.query.limite)));
  } catch (err) {
    next(err);
  }
}

export async function recentes(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.listarRecentes(Number(req.query.limite)));
  } catch (err) {
    next(err);
  }
}

export async function buscar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.buscarProduto(Number(req.params.id), verInativos(req)));
  } catch (err) {
    next(err);
  }
}

export async function criar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await produtoService.criarProduto(req.body, req.usuarioAutenticado!.id_usuario));
  } catch (err) {
    next(err);
  }
}

export async function atualizar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const produto = await produtoService.atualizarProduto(
      Number(req.params.id),
      req.body,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(produto);
  } catch (err) {
    next(err);
  }
}

export async function inativar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await produtoService.inativarProduto(Number(req.params.id), req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function ajustarEstoque(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const produto = await produtoService.ajustarEstoque(
      Number(req.params.id),
      req.body.ajuste,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(produto);
  } catch (err) {
    next(err);
  }
}

export async function enviarImagem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new ErroHttp(400, 'Envie a imagem no campo "imagem" (multipart/form-data)');
    }
    const produto = await produtoService.trocarImagem(
      Number(req.params.id),
      req.file.buffer,
      req.usuarioAutenticado!.id_usuario
    );
    res.status(200).json(produto);
  } catch (err) {
    next(err);
  }
}

export async function removerImagem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await produtoService.removerImagem(Number(req.params.id), req.usuarioAutenticado!.id_usuario);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function reporEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.reporEstoque(Number(req.params.id), req.body.quantidade));
  } catch (err) {
    next(err);
  }
}

export async function resumo(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await produtoService.resumoDoCatalogo());
  } catch (err) {
    next(err);
  }
}

export async function enviarImagem(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await imagemService.salvarImagemDoProduto(Number(req.params.id), req.file as Express.Multer.File));
  } catch (err) {
    next(err);
  }
}
