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
const produtoController = __importStar(require("../controllers/produtoController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const validate_1 = require("../middlewares/validate");
const uploadImagem_1 = require("../middlewares/uploadImagem");
const catalogo_1 = require("../config/catalogo");
const produtoValidators_1 = require("../validators/produtoValidators");
const paramsValidators_1 = require("../validators/paramsValidators");
const router = (0, express_1.Router)();
const podeGerenciar = (0, permissaoMiddleware_1.exigirPermissao)(catalogo_1.permissaoGerenciar);
router.get('/', authMiddleware_1.autenticarOpcional, (0, validate_1.validar)(produtoValidators_1.listarProdutosQuerySchema, 'query'), produtoController.listar);
router.get('/destaque', (0, validate_1.validar)(produtoValidators_1.vitrineQuerySchema, 'query'), produtoController.destaques);
router.get('/recentes', (0, validate_1.validar)(produtoValidators_1.vitrineQuerySchema, 'query'), produtoController.recentes);
router.get('/:id', authMiddleware_1.autenticarOpcional, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), produtoController.buscar);
router.post('/', authMiddleware_1.autenticar, podeGerenciar, (0, validate_1.validar)(produtoValidators_1.criarProdutoSchema), produtoController.criar);
router.patch('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), podeGerenciar, (0, validate_1.validar)(produtoValidators_1.atualizarProdutoSchema), produtoController.atualizar);
router.delete('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), podeGerenciar, produtoController.inativar);
router.patch('/:id/estoque', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), podeGerenciar, (0, validate_1.validar)(produtoValidators_1.ajustarEstoqueSchema), produtoController.ajustarEstoque);
router.put('/:id/imagem', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), podeGerenciar, uploadImagem_1.receberImagem, produtoController.enviarImagem);
router.delete('/:id/imagem', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), podeGerenciar, produtoController.removerImagem);
exports.default = router;
