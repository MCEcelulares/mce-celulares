import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Produto } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { pastaUploads, urlBaseImagens } from '../config/uploads';
import { apagarCache } from '../utils/cache';
import { registrarEvento } from '../utils/metricas';
import { logger } from '../utils/logger';

type Extensao = 'jpg' | 'png' | 'webp';

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOME_GERADO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Descobre o tipo pelos primeiros bytes, não pelo que o cliente declarou.
export function detectarTipo(conteudo: Buffer): Extensao | null {
  if (conteudo.length >= 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff) return 'jpg';
  if (conteudo.length >= 8 && conteudo.subarray(0, 8).equals(ASSINATURA_PNG)) return 'png';
  if (
    conteudo.length >= 12 &&
    conteudo.subarray(0, 4).toString('ascii') === 'RIFF' &&
    conteudo.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

async function removerImagemAnterior(urlAnterior: string | null) {
  const prefixo = `${urlBaseImagens()}/`;
  if (!urlAnterior?.startsWith(prefixo)) return; // imagem externa (URL) não é nossa
  const nome = path.basename(urlAnterior);
  if (!NOME_GERADO.test(nome)) return;
  try {
    await fs.unlink(path.join(pastaUploads(), nome));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err, nome }, 'não foi possível remover a imagem anterior do produto');
    }
  }
}

// RF15: anexa a imagem ao produto. O nome do arquivo é gerado pelo servidor (nunca o do cliente).
export async function salvarImagemDoProduto(id: number, arquivo: Express.Multer.File) {
  const produto = await Produto.findByPk(id);
  if (!produto) throw new ErroHttp(404, 'Produto não existe');

  const extensao = detectarTipo(arquivo.buffer);
  if (!extensao) throw new ErroHttp(415, 'O arquivo não é uma imagem JPEG, PNG ou WEBP válida');

  const nome = `${randomUUID()}.${extensao}`;
  await fs.mkdir(pastaUploads(), { recursive: true });
  await fs.writeFile(path.join(pastaUploads(), nome), arquivo.buffer);

  const anterior = produto.imagem;
  const url = `${urlBaseImagens()}/${nome}`;
  await produto.update({ imagem: url });
  await apagarCache(`produto:${id}`);
  await removerImagemAnterior(anterior);

  registrarEvento('imagem_enviada');
  return { id_produto: id, imagem: url };
}
