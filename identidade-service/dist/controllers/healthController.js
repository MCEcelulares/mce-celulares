"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vivo = vivo;
exports.pronto = pronto;
exports.metricas = metricas;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const metricas_1 = require("../utils/metricas");
const logger_1 = require("../utils/logger");
function vivo(_req, res) {
    res.status(200).json({ status: 'ok', servico: 'identidade-service' });
}
async function pronto(_req, res) {
    let banco = 'ok';
    try {
        await database_1.sequelize.authenticate();
    }
    catch (err) {
        banco = 'falha';
        logger_1.logger.error({ err }, 'healthcheck: banco indisponível');
    }
    const cache = (await (0, redis_1.redisDisponivel)()) ? 'ok' : 'falha';
    if (banco === 'falha') {
        return res.status(503).json({ status: 'indisponivel', servico: 'identidade-service', banco, redis: cache });
    }
    const status = cache === 'ok' ? 'ok' : 'degradado';
    return res.status(200).json({ status, servico: 'identidade-service', banco, redis: cache });
}
async function metricas(req, res) {
    const token = process.env.METRICS_TOKEN;
    if (!token) {
        return res.status(404).json({ erro: 'Rota não encontrada' });
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
        return res.status(401).json({ erro: 'Token de métricas inválido' });
    }
    res.set('Content-Type', metricas_1.registro.contentType);
    return res.status(200).send(await metricas_1.registro.metrics());
}
