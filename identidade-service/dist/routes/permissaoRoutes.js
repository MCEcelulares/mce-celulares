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
const permissaoController = __importStar(require("../controllers/permissaoController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const validate_1 = require("../middlewares/validate");
const cargoValidators_1 = require("../validators/cargoValidators");
const paramsValidators_1 = require("../validators/paramsValidators");
const router = (0, express_1.Router)();
const pode = (0, permissaoMiddleware_1.exigirPermissao)('cargos:gerenciar');
router.get('/', authMiddleware_1.autenticar, pode, permissaoController.listar);
router.get('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), pode, permissaoController.buscar);
router.post('/', authMiddleware_1.autenticar, pode, (0, validate_1.validar)(cargoValidators_1.criarPermissaoSchema), permissaoController.criar);
router.patch('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), pode, (0, validate_1.validar)(cargoValidators_1.atualizarPermissaoSchema), permissaoController.renomear);
router.delete('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), pode, permissaoController.excluir);
exports.default = router;
