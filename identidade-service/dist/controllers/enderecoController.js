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
exports.marcarPrincipal = marcarPrincipal;
exports.remover = remover;
const enderecoService = __importStar(require("../services/enderecoService"));
async function listar(req, res, next) {
    try {
        res.status(200).json(await enderecoService.listarEnderecos(Number(req.params.id)));
    }
    catch (err) {
        next(err);
    }
}
async function buscar(req, res, next) {
    try {
        const endereco = await enderecoService.buscarEndereco(Number(req.params.id), Number(req.params.idEndereco));
        res.status(200).json(endereco);
    }
    catch (err) {
        next(err);
    }
}
async function criar(req, res, next) {
    try {
        res.status(201).json(await enderecoService.criarEndereco(Number(req.params.id), req.body));
    }
    catch (err) {
        next(err);
    }
}
async function atualizar(req, res, next) {
    try {
        const endereco = await enderecoService.atualizarEndereco(Number(req.params.id), Number(req.params.idEndereco), req.body);
        res.status(200).json(endereco);
    }
    catch (err) {
        next(err);
    }
}
async function marcarPrincipal(req, res, next) {
    try {
        const endereco = await enderecoService.marcarEnderecoPrincipal(Number(req.params.id), Number(req.params.idEndereco));
        res.status(200).json(endereco);
    }
    catch (err) {
        next(err);
    }
}
async function remover(req, res, next) {
    try {
        await enderecoService.removerEndereco(Number(req.params.id), Number(req.params.idEndereco));
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
