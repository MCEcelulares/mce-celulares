import { createHash, randomBytes } from 'crypto';
import { redis } from '../config/redis';
import { ErroHttp } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

const ttlSegundos = Number(process.env.REFRESH_TOKEN_TTL_DIAS ?? 7) * 24 * 60 * 60;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const chaveToken = (h: string) => `identidade:rt:${h}`;
const chaveSessoesDoUsuario = (idUsuario: number) => `identidade:rt:usuario:${idUsuario}`;

export async function criarRefreshToken(idUsuario: number): Promise<string | null> {
  const token = randomBytes(48).toString('base64url');
  const h = hash(token);
  try {
    await redis
      .multi()
      .set(chaveToken(h), String(idUsuario), 'EX', ttlSegundos)
      .sadd(chaveSessoesDoUsuario(idUsuario), h)
      .expire(chaveSessoesDoUsuario(idUsuario), ttlSegundos)
      .exec();
    return token;
  } catch (err) {
    logger.error({ err, id_usuario: idUsuario }, 'não foi possível criar o refresh token (redis indisponível?)');
    return null;
  }
}

export async function consumirRefreshToken(token: string): Promise<number | null> {
  const h = hash(token);
  try {
    const resultado = await redis.multi().get(chaveToken(h)).del(chaveToken(h)).exec();
    const idUsuario = resultado?.[0]?.[1] as string | null | undefined;
    if (!idUsuario) return null;
    await redis.srem(chaveSessoesDoUsuario(Number(idUsuario)), h);
    return Number(idUsuario);
  } catch (err) {
    logger.error({ err }, 'falha ao consumir refresh token');
    throw new ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
  }
}

export async function revogarRefreshToken(token: string): Promise<void> {
  const h = hash(token);
  try {
    const idUsuario = await redis.get(chaveToken(h));
    await redis.del(chaveToken(h));
    if (idUsuario) await redis.srem(chaveSessoesDoUsuario(Number(idUsuario)), h);
  } catch (err) {
    logger.error({ err }, 'falha ao revogar refresh token');
    throw new ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
  }
}

export async function revogarTodasAsSessoes(idUsuario: number): Promise<void> {
  try {
    const hashes = await redis.smembers(chaveSessoesDoUsuario(idUsuario));
    if (hashes.length > 0) await redis.del(...hashes.map(chaveToken));
    await redis.del(chaveSessoesDoUsuario(idUsuario));
    logger.info({ id_usuario: idUsuario, sessoes: hashes.length }, 'sessões revogadas');
  } catch (err) {
    logger.error({ err, id_usuario: idUsuario }, 'falha ao revogar sessões do usuário');
    throw new ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
  }
}

export async function revogarTodasAsSessoesSemFalhar(idUsuario: number): Promise<void> {
  try {
    await revogarTodasAsSessoes(idUsuario);
  } catch {
    logger.error({ id_usuario: idUsuario }, 'ATENÇÃO: sessões antigas NÃO foram revogadas');
  }
}
