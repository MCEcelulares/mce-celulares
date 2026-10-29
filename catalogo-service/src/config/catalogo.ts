import path from 'path';
import 'dotenv/config';

export const permissaoGerenciar = 'catalogo:gerenciar';

export const tamanhoMaximoImagem = 5 * 1024 * 1024;
export const extensaoPorTipoDeImagem = { jpg: 'jpg', png: 'png', webp: 'webp' } as const;

export const diretorioDeImagens = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
export const urlBaseDasImagens = (process.env.IMAGENS_URL_BASE ?? '/catalogo/imagens').replace(/\/$/, '');

export const limitePadraoListagem = 12;
export const limiteMaximoListagem = 100;
export const limitePadraoVitrine = 8;
export const limiteMaximoVitrine = 24;

export const statusReserva = { ativa: 'ATIVA', devolvida: 'DEVOLVIDA' } as const;
