export type TipoDeImagem = 'jpg' | 'png' | 'webp';

const assinaturaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const comeca = (buffer: Buffer, bytes: number[], deslocamento = 0) =>
  buffer.length >= deslocamento + bytes.length && bytes.every((b, i) => buffer[deslocamento + i] === b);

export function detectarTipoDeImagem(buffer: Buffer): TipoDeImagem | null {
  if (comeca(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (comeca(buffer, assinaturaPng)) return 'png';
  if (comeca(buffer, [0x52, 0x49, 0x46, 0x46]) && comeca(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}
