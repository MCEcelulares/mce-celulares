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
exports.reservar = reservar;
exports.devolver = devolver;
exports.buscarReserva = buscarReserva;
exports.consultarProdutos = consultarProdutos;
const estoqueService = __importStar(require("../services/estoqueService"));
const produtoService = __importStar(require("../services/produtoService"));
async function reservar(req, res, next) {
    try {
        const { criada, reserva } = await estoqueService.reservarEstoque(req.body);
        res.status(criada ? 201 : 200).json(reserva);
    }
    catch (err) {
        next(err);
    }
}
async function devolver(req, res, next) {
    try {
        res.status(200).json(await estoqueService.devolverReserva(Number(req.params.idPedido)));
    }
    catch (err) {
        next(err);
    }
}
async function buscarReserva(req, res, next) {
    try {
        res.status(200).json(await estoqueService.buscarReserva(Number(req.params.idPedido)));
    }
    catch (err) {
        next(err);
    }
}
async function consultarProdutos(req, res, next) {
    try {
        res.status(200).json(await produtoService.consultarProdutosInterno(req.query.ids));
    }
    catch (err) {
        next(err);
    }
}
