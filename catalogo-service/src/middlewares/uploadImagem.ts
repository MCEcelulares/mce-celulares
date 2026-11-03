import multer from 'multer';
import { tamanhoMaximoImagem } from '../config/catalogo';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: tamanhoMaximoImagem, files: 1 },
});

export const receberImagem = upload.single('imagem');
