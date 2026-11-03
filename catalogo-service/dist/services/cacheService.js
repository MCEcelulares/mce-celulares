"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obterOuCarregar = obterOuCarregar;
exports.invalidarCatalogo = invalidarCatalogo;
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const chaveVersao = 'catalogo:versao';
const ttlSegundos = () => Number(process.env.CACHE_TTL_SEGUNDOS ?? 300);
// Cache-aside: lê do Redis; no miss, carrega do banco e grava com TTL.
// Redis fora do ar nunca derruba a requisição: cai direto no banco (degradação graciosa).
async function obterOuCarregar(chave, carregar) {
    let chaveCompleta = null;
    try {
        const versao = (await redis_1.redis.get(chaveVersao)) ?? '0';
        chaveCompleta = `catalogo:v${versao}:${chave}`;
        const emCache = await redis_1.redis.get(chaveCompleta);
        if (emCache) {
            (0, metricas_1.registrarCache)('hit');
            return JSON.parse(emCache);
        }
        (0, metricas_1.registrarCache)('miss');
    }
    catch (err) {
        (0, metricas_1.registrarCache)('erro');
        logger_1.logger.warn({ motivo: err.message }, 'cache indisponível: consultando o banco');
    }
    const valor = await carregar();
    if (chaveCompleta) {
        try {
            await redis_1.redis.set(chaveCompleta, JSON.stringify(valor), 'EX', ttlSegundos());
        }
        catch (err) {
            logger_1.logger.warn({ motivo: err.message }, 'cache indisponível: não foi possível gravar');
        }
    }
    return valor;
}
// Invalidação por versão: incrementar a versão deixa todas as chaves antigas órfãs (expiram pelo TTL),
// sem precisar de SCAN/DEL em massa.
async function invalidarCatalogo() {
    try {
        await redis_1.redis.incr(chaveVersao);
    }
    catch (err) {
        logger_1.logger.warn({ motivo: err.message }, 'cache indisponível: invalidação não aplicada (vale o TTL)');
    }
}
