"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.redisDisponivel = redisDisponivel;
exports.aguardarRedis = aguardarRedis;
const ioredis_1 = __importDefault(require("ioredis"));
require("dotenv/config");
const logger_1 = require("../utils/logger");
exports.redis = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy: (tentativa) => Math.min(tentativa * 500, 5000),
});
exports.redis.on('error', (err) => logger_1.logger.warn({ motivo: err.message }, 'redis: erro de conexão'));
exports.redis.on('ready', () => logger_1.logger.info('redis: conectado'));
async function redisDisponivel() {
    try {
        return (await exports.redis.ping()) === 'PONG';
    }
    catch {
        return false;
    }
}
async function aguardarRedis(timeoutMs = 3000) {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
        if (await redisDisponivel())
            return;
        await new Promise((r) => setTimeout(r, 200));
    }
    logger_1.logger.warn('redis indisponível na inicialização — o serviço sobe sem refresh token até ele voltar');
}
