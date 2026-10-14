"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarRefreshToken = criarRefreshToken;
exports.consumirRefreshToken = consumirRefreshToken;
exports.revogarRefreshToken = revogarRefreshToken;
exports.revogarTodasAsSessoes = revogarTodasAsSessoes;
exports.revogarTodasAsSessoesSemFalhar = revogarTodasAsSessoesSemFalhar;
const crypto_1 = require("crypto");
const redis_1 = require("../config/redis");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const ttlSegundos = Number(process.env.REFRESH_TOKEN_TTL_DIAS ?? 7) * 24 * 60 * 60;
const hash = (token) => (0, crypto_1.createHash)('sha256').update(token).digest('hex');
const chaveToken = (h) => `identidade:rt:${h}`;
const chaveSessoesDoUsuario = (idUsuario) => `identidade:rt:usuario:${idUsuario}`;
async function criarRefreshToken(idUsuario) {
    const token = (0, crypto_1.randomBytes)(48).toString('base64url');
    const h = hash(token);
    try {
        await redis_1.redis
            .multi()
            .set(chaveToken(h), String(idUsuario), 'EX', ttlSegundos)
            .sadd(chaveSessoesDoUsuario(idUsuario), h)
            .expire(chaveSessoesDoUsuario(idUsuario), ttlSegundos)
            .exec();
        return token;
    }
    catch (err) {
        logger_1.logger.error({ err, id_usuario: idUsuario }, 'não foi possível criar o refresh token (redis indisponível?)');
        return null;
    }
}
async function consumirRefreshToken(token) {
    const h = hash(token);
    try {
        const resultado = await redis_1.redis.multi().get(chaveToken(h)).del(chaveToken(h)).exec();
        const idUsuario = resultado?.[0]?.[1];
        if (!idUsuario)
            return null;
        await redis_1.redis.srem(chaveSessoesDoUsuario(Number(idUsuario)), h);
        return Number(idUsuario);
    }
    catch (err) {
        logger_1.logger.error({ err }, 'falha ao consumir refresh token');
        throw new errorHandler_1.ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
    }
}
async function revogarRefreshToken(token) {
    const h = hash(token);
    try {
        const idUsuario = await redis_1.redis.get(chaveToken(h));
        await redis_1.redis.del(chaveToken(h));
        if (idUsuario)
            await redis_1.redis.srem(chaveSessoesDoUsuario(Number(idUsuario)), h);
    }
    catch (err) {
        logger_1.logger.error({ err }, 'falha ao revogar refresh token');
        throw new errorHandler_1.ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
    }
}
async function revogarTodasAsSessoes(idUsuario) {
    try {
        const hashes = await redis_1.redis.smembers(chaveSessoesDoUsuario(idUsuario));
        if (hashes.length > 0)
            await redis_1.redis.del(...hashes.map(chaveToken));
        await redis_1.redis.del(chaveSessoesDoUsuario(idUsuario));
        logger_1.logger.info({ id_usuario: idUsuario, sessoes: hashes.length }, 'sessões revogadas');
    }
    catch (err) {
        logger_1.logger.error({ err, id_usuario: idUsuario }, 'falha ao revogar sessões do usuário');
        throw new errorHandler_1.ErroHttp(503, 'Serviço de sessão indisponível. Tente novamente.');
    }
}
async function revogarTodasAsSessoesSemFalhar(idUsuario) {
    try {
        await revogarTodasAsSessoes(idUsuario);
    }
    catch {
        logger_1.logger.error({ id_usuario: idUsuario }, 'ATENÇÃO: sessões antigas NÃO foram revogadas');
    }
}
