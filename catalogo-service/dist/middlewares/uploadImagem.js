"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receberImagem = void 0;
const multer_1 = __importDefault(require("multer"));
const catalogo_1 = require("../config/catalogo");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: catalogo_1.tamanhoMaximoImagem, files: 1 },
});
exports.receberImagem = upload.single('imagem');
