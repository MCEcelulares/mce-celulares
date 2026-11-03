import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

const publicKey = crypto
  .createPublicKey((process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n').trim())
  .export({ type: 'spki', format: 'pem' }) as string;

export interface TokenPayload {
  id_usuario: number;
  email: string;
  admin: boolean;
  cargos: string[];
  permissoes: string[];
}

export function validarToken(token: string): TokenPayload {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as TokenPayload;
}
