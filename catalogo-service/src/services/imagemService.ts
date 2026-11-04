import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { diretorioDeImagens, urlBaseDasImagens } from '../config/catalogo';
import { detectarTipoDeImagem } from '../utils/imagem';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

export async function garantirDiretorioDeImagens() {
  await fs.mkdir(diretorioDeImagens, { recursive: true });
}

export function urlDaImagem(arquivo: string | null | undefined): string | null {
  return arquivo ? `${urlBaseDasImagens}/${arquivo}` : null;
}

// Confere o conteúdo real do arquivo (magic bytes), não o mimetype/extensão informados pelo cliente.
export async function gravarImagem(buffer: Buffer): Promise<string> {
  const tipo = detectarTipoDeImagem(buffer);
  if (!tipo) {
    throw new ErroHttp(400, 'Arquivo inválido: envie uma imagem JPG, PNG ou WEBP');
  }

  await garantirDiretorioDeImagens();
  const arquivo = `${randomUUID()}.${tipo}`;
  await fs.writeFile(path.join(diretorioDeImagens, arquivo), buffer);
  return arquivo;
}

export async function apagarImagem(arquivo: string | null | undefined) {
  if (!arquivo) return;
  const nome = path.basename(arquivo);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(nome)) return;
  if (arquivo.includes('/') && !arquivo.startsWith(`${urlBaseDasImagens}/`)) return;
  if (arquivo.includes('/') && arquivo.slice(`${urlBaseDasImagens}/`.length) !== nome) return;
  try {
    await fs.unlink(path.join(diretorioDeImagens, nome));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ arquivo, motivo: (err as Error).message }, 'não foi possível apagar a imagem');
    }
  }
}
