"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErroHttp = void 0;
exports.rotaNaoEncontrada = rotaNaoEncontrada;
exports.tratarErros = tratarErros;
const logger_1 = require("../utils/logger");
class ErroHttp extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.ErroHttp = ErroHttp;
function rotaNaoEncontrada(_req, res) {
    res.status(404).json({ erro: 'Rota não encontrada' });
}
function tratarErros(err, _req, res, _next) {
    if (err instanceof ErroHttp) {
        logger_1.logger.warn({ status: err.status, motivo: err.message }, 'erro de negócio');
        return res.status(err.status).json({ erro: err.message });
    }
    if (err instanceof SyntaxError && 'body' in err) {
        logger_1.logger.warn({ motivo: err.message }, 'JSON inválido no corpo da requisição');
        return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
    }
    logger_1.logger.error({ err }, 'erro não tratado');
    return res.status(500).json({ erro: 'Erro interno do servidor' });
}
