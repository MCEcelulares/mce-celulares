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
const express_1 = require("express");
const estoqueController = __importStar(require("../controllers/estoqueController"));
const servicoMiddleware_1 = require("../middlewares/servicoMiddleware");
const validate_1 = require("../middlewares/validate");
const estoqueValidators_1 = require("../validators/estoqueValidators");
const paramsValidators_1 = require("../validators/paramsValidators");
// Rotas só para outros serviços (Vendas). O nginx bloqueia /catalogo/interno/ e aqui exigimos o token de serviço (ADR-009).
const router = (0, express_1.Router)();
router.use(servicoMiddleware_1.autenticarServico);
router.get('/produtos', (0, validate_1.validar)(estoqueValidators_1.consultarProdutosInternoSchema, 'query'), estoqueController.consultarProdutos);
router.post('/reservas', (0, validate_1.validar)(estoqueValidators_1.reservarEstoqueSchema), estoqueController.reservar);
router.get('/reservas/:idPedido', (0, validate_1.validar)(paramsValidators_1.idPedidoParamSchema, 'params'), estoqueController.buscarReserva);
router.post('/reservas/:idPedido/devolucao', (0, validate_1.validar)(paramsValidators_1.idPedidoParamSchema, 'params'), estoqueController.devolver);
exports.default = router;
