"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
require("dotenv/config");
const contexto_1 = require("./contexto");
const saidaLegivel = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { servico: 'identidade-service' },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    mixin: () => ({ idCorrelacao: contexto_1.contextoRequisicao.getStore()?.idCorrelacao }),
    redact: ['req.headers.authorization', 'senha', 'novaSenha', 'senhaAtual', 'refreshToken', '*.senha'],
    transport: saidaLegivel ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
