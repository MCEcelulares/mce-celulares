"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusReserva = exports.limiteMaximoVitrine = exports.limitePadraoVitrine = exports.limiteMaximoListagem = exports.limitePadraoListagem = exports.urlBaseDasImagens = exports.diretorioDeImagens = exports.extensaoPorTipoDeImagem = exports.tamanhoMaximoImagem = exports.permissaoGerenciar = void 0;
const path_1 = __importDefault(require("path"));
require("dotenv/config");
exports.permissaoGerenciar = 'catalogo:gerenciar';
exports.tamanhoMaximoImagem = 5 * 1024 * 1024;
exports.extensaoPorTipoDeImagem = { jpg: 'jpg', png: 'png', webp: 'webp' };
exports.diretorioDeImagens = path_1.default.resolve(process.env.UPLOAD_DIR ?? 'uploads');
exports.urlBaseDasImagens = (process.env.IMAGENS_URL_BASE ?? '/catalogo/imagens').replace(/\/$/, '');
exports.limitePadraoListagem = 12;
exports.limiteMaximoListagem = 100;
exports.limitePadraoVitrine = 8;
exports.limiteMaximoVitrine = 24;
exports.statusReserva = { ativa: 'ATIVA', devolvida: 'DEVOLVIDA' };
