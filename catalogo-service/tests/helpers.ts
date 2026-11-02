import jwt from 'jsonwebtoken';
import { deflateSync } from 'zlib';

export function gerarToken(permissoes: string[], idUsuario = 1) {
  return jwt.sign(
    { id_usuario: idUsuario, email: `u${idUsuario}@mce.test`, admin: false, cargos: [], permissoes },
    process.env.JWT_PRIVATE_KEY_TESTE as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
}

export function gerarTokenExpirado() {
  return jwt.sign(
    { id_usuario: 1, email: 'u@mce.test', admin: false, cargos: [], permissoes: ['catalogo:gerenciar'] },
    process.env.JWT_PRIVATE_KEY_TESTE as string,
    { algorithm: 'RS256', expiresIn: -60 }
  );
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// PNG mínimo válido (1x1), suficiente para passar pela checagem de assinatura.
export function pngMinimo(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'),
    Buffer.from('0000000a49444154789c6300010000050001', 'hex'),
    deflateSync(Buffer.from([0])).subarray(0, 0),
    Buffer.from('0d0a2db40000000049454e44ae426082', 'hex'),
  ]);
}
