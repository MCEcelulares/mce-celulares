"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErroHttp = void 0;
exports.rotaNaoEncontrada = rotaNaoEncontrada;
exports.tratarErros = tratarErros;
const multer_1 = require("multer");
const logger_1 = require("../utils/logger");
const catalogo_1 = require("../config/catalogo");
class ErroHttp extends Error {
    constructor(status, message, detalhes) {
        super(message);
        this.status = status;
        this.detalhes = detalhes;
    }
}
exports.ErroHttp = ErroHttp;
function rotaNaoEncontrada(_req, res) {
    res.status(404).json({ erro: 'Rota não encontrada' });
}
function tratarErros(err, _req, res, _next) {
    if (err instanceof ErroHttp) {
        logger_1.logger.warn({ status: err.status, motivo: err.message }, 'erro de negócio');
        return res.status(err.status).json(err.detalhes ? { erro: err.message, detalhes: err.detalhes } : { erro: err.message });
    }
    if (err instanceof multer_1.MulterError) {
        logger_1.logger.warn({ codigo: err.code, motivo: err.message }, 'erro no upload');
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ erro: `Imagem maior que ${catalogo_1.tamanhoMaximoImagem / 1024 / 1024} MB` });
        }
        return res.status(400).json({ erro: 'Upload inválido. Envie um único arquivo no campo "imagem"' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
        logger_1.logger.warn({ motivo: err.message }, 'JSON inválido no corpo da requisição');
        return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
    }
    logger_1.logger.error({ err }, 'erro não tratado');
    return res.status(500).json({ erro: 'Erro interno do servidor' });
}
