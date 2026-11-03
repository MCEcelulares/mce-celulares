"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.garantirDiretorioDeImagens = garantirDiretorioDeImagens;
exports.urlDaImagem = urlDaImagem;
exports.gravarImagem = gravarImagem;
exports.apagarImagem = apagarImagem;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const catalogo_1 = require("../config/catalogo");
const imagem_1 = require("../utils/imagem");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
async function garantirDiretorioDeImagens() {
    await promises_1.default.mkdir(catalogo_1.diretorioDeImagens, { recursive: true });
}
function urlDaImagem(arquivo) {
    return arquivo ? `${catalogo_1.urlBaseDasImagens}/${arquivo}` : null;
}
// Confere o conteúdo real do arquivo (magic bytes), não o mimetype/extensão informados pelo cliente.
async function gravarImagem(buffer) {
    const tipo = (0, imagem_1.detectarTipoDeImagem)(buffer);
    if (!tipo) {
        throw new errorHandler_1.ErroHttp(400, 'Arquivo inválido: envie uma imagem JPG, PNG ou WEBP');
    }
    await garantirDiretorioDeImagens();
    const arquivo = `${(0, crypto_1.randomUUID)()}.${tipo}`;
    await promises_1.default.writeFile(path_1.default.join(catalogo_1.diretorioDeImagens, arquivo), buffer);
    return arquivo;
}
async function apagarImagem(arquivo) {
    if (!arquivo)
        return;
    try {
        await promises_1.default.unlink(path_1.default.join(catalogo_1.diretorioDeImagens, path_1.default.basename(arquivo)));
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            logger_1.logger.warn({ arquivo, motivo: err.message }, 'não foi possível apagar a imagem');
        }
    }
}
