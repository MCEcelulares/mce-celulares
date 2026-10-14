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
const usuarioController = __importStar(require("../controllers/usuarioController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const validate_1 = require("../middlewares/validate");
const rateLimit_1 = require("../utils/rateLimit");
const usuarioValidators_1 = require("../validators/usuarioValidators");
const paramsValidators_1 = require("../validators/paramsValidators");
const router = (0, express_1.Router)();
router.post('/', rateLimit_1.limitarCadastro, (0, validate_1.validar)(usuarioValidators_1.criarUsuarioSchema), usuarioController.criar);
router.get('/', authMiddleware_1.autenticar, (0, permissaoMiddleware_1.exigirPermissao)('usuarios:listar'), (0, validate_1.validar)(usuarioValidators_1.listarUsuariosQuerySchema, 'query'), usuarioController.listar);
router.get('/me', authMiddleware_1.autenticar, usuarioController.me);
router.patch('/me', authMiddleware_1.autenticar, (0, validate_1.validar)(usuarioValidators_1.atualizarPerfilSchema), usuarioController.atualizarPerfil);
router.patch('/me/senha', authMiddleware_1.autenticar, (0, validate_1.validar)(usuarioValidators_1.alterarSenhaSchema), usuarioController.alterarSenha);
router.get('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), (0, permissaoMiddleware_1.donoOuPermissao)('usuarios:ver'), usuarioController.buscarPorId);
router.patch('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), (0, permissaoMiddleware_1.exigirPermissao)('usuarios:editar'), (0, validate_1.validar)(usuarioValidators_1.atualizarUsuarioAdminSchema), usuarioController.atualizarComoAdmin);
router.patch('/:id/status', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), (0, permissaoMiddleware_1.exigirPermissao)('usuarios:editar'), (0, validate_1.validar)(usuarioValidators_1.alterarStatusSchema), usuarioController.alterarStatus);
router.delete('/:id', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), (0, permissaoMiddleware_1.exigirPermissao)('usuarios:excluir'), usuarioController.excluir);
router.put('/:id/cargos', authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, 'params'), (0, permissaoMiddleware_1.exigirPermissao)('usuarios:gerenciar-cargos'), (0, validate_1.validar)(usuarioValidators_1.definirCargosSchema), usuarioController.definirCargos);
exports.default = router;
