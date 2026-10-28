import jwt from 'jsonwebtoken';
import 'dotenv/config';

const publicKey = (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n').trim();

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
