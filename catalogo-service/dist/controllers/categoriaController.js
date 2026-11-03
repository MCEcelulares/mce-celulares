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
exports.buscar = buscar;
exports.criar = criar;
exports.atualizar = atualizar;
exports.excluir = excluir;
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const catalogo_1 = require("../config/catalogo");
const categoriaService = __importStar(require("../services/categoriaService"));
const verInativos = (req, quer = true) => quer && (0, permissaoMiddleware_1.temPermissao)(req, catalogo_1.permissaoGerenciar);
async function listar(req, res, next) {
    try {
        const quer = req.query.incluirInativos ?? false;
        res.status(200).json(await categoriaService.listarCategorias(verInativos(req, quer)));
    }
    catch (err) {
        next(err);
    }
}
async function buscar(req, res, next) {
    try {
        res.status(200).json(await categoriaService.buscarCategoria(Number(req.params.id), verInativos(req)));
    }
    catch (err) {
        next(err);
    }
}
async function criar(req, res, next) {
    try {
        res.status(201).json(await categoriaService.criarCategoria(req.body, req.usuarioAutenticado.id_usuario));
    }
    catch (err) {
        next(err);
    }
}
async function atualizar(req, res, next) {
    try {
        const categoria = await categoriaService.atualizarCategoria(Number(req.params.id), req.body, req.usuarioAutenticado.id_usuario);
        res.status(200).json(categoria);
    }
    catch (err) {
        next(err);
    }
}
async function excluir(req, res, next) {
    try {
        await categoriaService.excluirCategoria(Number(req.params.id), req.usuarioAutenticado.id_usuario);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
