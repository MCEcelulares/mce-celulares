"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autenticarServico = autenticarServico;
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
function tokensIguais(recebido, esperado) {
    const a = Buffer.from(recebido);
    const b = Buffer.from(esperado);
    return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
}
function autenticarServico(req, res, next) {
    const esperado = process.env.SERVICE_TOKEN;
    if (!esperado) {
        logger_1.logger.error('SERVICE_TOKEN não configurado: rotas internas desativadas');
        return res.status(503).json({ erro: 'Rotas internas indisponíveis' });
    }
    const recebido = req.headers['x-service-token'];
    if (typeof recebido !== 'string' || !tokensIguais(recebido, esperado)) {
        logger_1.logger.warn('rota interna: token de serviço ausente ou inválido');
        return res.status(401).json({ erro: 'Token de serviço inválido' });
    }
    next();
}
