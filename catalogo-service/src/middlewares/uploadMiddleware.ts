import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErroHttp } from './errorHandler';

export const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

// RNF07: limita tamanho e tipo. O tipo declarado pelo cliente é só a primeira barreira; o conteúdo é
// conferido de novo pelos bytes iniciais em imagemService.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_IMAGEM, files: 1, fields: 0 },
  fileFilter: (_req, arquivo, cb) => {
    if (!TIPOS_ACEITOS.includes(arquivo.mimetype)) {
      return cb(new ErroHttp(415, 'Envie uma imagem JPEG, PNG ou WEBP'));
    }
    return cb(null, true);
  },
});

export function receberImagem(req: Request, res: Response, next: NextFunction) {
  upload.single('imagem')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ErroHttp(413, 'A imagem deve ter no máximo 2 MB'));
      return next(new ErroHttp(400, 'Envio inválido: use um único arquivo no campo "imagem"'));
    }
    if (err) return next(err);
    if (!req.file) return next(new ErroHttp(400, 'Envie o arquivo no campo "imagem"'));
    return next();
  });
}
