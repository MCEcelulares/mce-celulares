"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logarRequisicao = logarRequisicao;
const crypto_1 = require("crypto");
const pino_http_1 = __importDefault(require("pino-http"));
const logger_1 = require("../utils/logger");
const contexto_1 = require("../utils/contexto");
const caminho = (req) => (req.originalUrl ?? req.url ?? '').split('?')[0];
const logHttp = (0, pino_http_1.default)({
    logger: logger_1.logger,
    genReqId: (req, res) => {
        const recebido = req.headers['x-correlation-id'];
        const id = typeof recebido === 'string' && recebido.length > 0 ? recebido : (0, crypto_1.randomUUID)();
        res.setHeader('x-correlation-id', id);
        return id;
    },
    customProps: (req) => ({ idCorrelacao: String(req.id) }),
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${caminho(req)} -> ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${caminho(req)} -> ${res.statusCode}`,
    serializers: {
        req: (req) => ({ method: req.method, url: caminho(req) }),
        res: (res) => ({ statusCode: res.statusCode }),
    },
});
function logarRequisicao(req, res, next) {
    logHttp(req, res, () => {
        contexto_1.contextoRequisicao.run({ idCorrelacao: String(req.id) }, next);
    });
}
