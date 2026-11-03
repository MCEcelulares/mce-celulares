"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listar = listar;
exports.destaques = destaques;
exports.recentes = recentes;
exports.buscar = buscar;
exports.criar = criar;
exports.atualizar = atualizar;
exports.inativar = inativar;
exports.ajustarEstoque = ajustarEstoque;
exports.enviarImagem = enviarImagem;
exports.removerImagem = removerImagem;
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const errorHandler_1 = require("../middlewares/errorHandler");
const catalogo_1 = require("../config/catalogo");
const produtoService = __importStar(require("../services/produtoService"));
const verInativos = (req, quer = true) => quer && (0, permissaoMiddleware_1.temPermissao)(req, catalogo_1.permissaoGerenciar);
async function listar(req, res, next) {
    try {
        const filtros = req.query;
        res.status(200).json(await produtoService.listarProdutos(filtros, verInativos(req, filtros.incluirInativos ?? false)));
    }
    catch (err) {
        next(err);
    }
}
async function destaques(req, res, next) {
    try {
        res.status(200).json(await produtoService.listarDestaques(Number(req.query.limite)));
    }
    catch (err) {
        next(err);
    }
}
async function recentes(req, res, next) {
    try {
        res.status(200).json(await produtoService.listarRecentes(Number(req.query.limite)));
    }
    catch (err) {
        next(err);
    }
}
async function buscar(req, res, next) {
    try {
        res.status(200).json(await produtoService.buscarProduto(Number(req.params.id), verInativos(req)));
    }
    catch (err) {
        next(err);
    }
}
async function criar(req, res, next) {
    try {
        res.status(201).json(await produtoService.criarProduto(req.body, req.usuarioAutenticado.id_usuario));
    }
    catch (err) {
        next(err);
    }
}
async function atualizar(req, res, next) {
    try {
        const produto = await produtoService.atualizarProduto(Number(req.params.id), req.body, req.usuarioAutenticado.id_usuario);
        res.status(200).json(produto);
    }
    catch (err) {
        next(err);
    }
}
async function inativar(req, res, next) {
    try {
        await produtoService.inativarProduto(Number(req.params.id), req.usuarioAutenticado.id_usuario);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
async function ajustarEstoque(req, res, next) {
    try {
        const produto = await produtoService.ajustarEstoque(Number(req.params.id), req.body.ajuste, req.usuarioAutenticado.id_usuario);
        res.status(200).json(produto);
    }
    catch (err) {
        next(err);
    }
}
async function enviarImagem(req, res, next) {
    try {
        if (!req.file) {
            throw new errorHandler_1.ErroHttp(400, 'Envie a imagem no campo "imagem" (multipart/form-data)');
        }
        const produto = await produtoService.trocarImagem(Number(req.params.id), req.file.buffer, req.usuarioAutenticado.id_usuario);
        res.status(200).json(produto);
    }
    catch (err) {
        next(err);
    }
}
async function removerImagem(req, res, next) {
    try {
        await produtoService.removerImagem(Number(req.params.id), req.usuarioAutenticado.id_usuario);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
