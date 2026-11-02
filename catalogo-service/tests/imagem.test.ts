import { detectarTipoDeImagem } from '../src/utils/imagem';
import { escaparLike } from '../src/utils/like';
import { pngMinimo } from './helpers';

describe('detectarTipoDeImagem', () => {
  it('reconhece JPG, PNG e WEBP pelo conteúdo', () => {
    expect(detectarTipoDeImagem(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpg');
    expect(detectarTipoDeImagem(pngMinimo())).toBe('png');
    expect(detectarTipoDeImagem(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('webp');
  });

  it('recusa texto, GIF e buffer vazio', () => {
    expect(detectarTipoDeImagem(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(detectarTipoDeImagem(Buffer.from('GIF89a'))).toBeNull();
    expect(detectarTipoDeImagem(Buffer.alloc(0))).toBeNull();
  });
});

describe('escaparLike', () => {
  it('escapa curingas do LIKE', () => {
    expect(escaparLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});
