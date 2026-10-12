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
const enderecoController = __importStar(require("../controllers/enderecoController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissaoMiddleware_1 = require("../middlewares/permissaoMiddleware");
const validate_1 = require("../middlewares/validate");
const enderecoValidators_1 = require("../validators/enderecoValidators");
const paramsValidators_1 = require("../validators/paramsValidators");
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)("usuarios:ver"), enderecoController.listar);
router.get("/:idEndereco", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.enderecoParamsSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)("usuarios:ver"), enderecoController.buscar);
router.post("/", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.idParamSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)(), (0, validate_1.validar)(enderecoValidators_1.criarEnderecoSchema), enderecoController.criar);
router.patch("/:idEndereco", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.enderecoParamsSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)(), (0, validate_1.validar)(enderecoValidators_1.atualizarEnderecoSchema), enderecoController.atualizar);
router.patch("/:idEndereco/principal", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.enderecoParamsSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)(), enderecoController.marcarPrincipal);
router.delete("/:idEndereco", authMiddleware_1.autenticar, (0, validate_1.validar)(paramsValidators_1.enderecoParamsSchema, "params"), (0, permissaoMiddleware_1.donoOuPermissao)(), enderecoController.remover);
exports.default = router;
