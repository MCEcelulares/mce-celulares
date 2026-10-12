import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

const privateKey = (process.env.JWT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) as string;

export interface TokenPayload {
  id_usuario: number;
  email: string;
  admin: boolean;
  cargos: string[];
  permissoes: string[];
}

export function assinarToken(payload: TokenPayload): string {
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, privateKey, options);
}

export function validarToken(token: string): TokenPayload {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as TokenPayload;
}
