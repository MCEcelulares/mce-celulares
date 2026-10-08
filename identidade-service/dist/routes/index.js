"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarioRoutes_1 = __importDefault(require("./usuarioRoutes"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const enderecoRoutes_1 = __importDefault(require("./enderecoRoutes"));
const router = (0, express_1.Router)();
router.use('/usuarios/:id/enderecos', enderecoRoutes_1.default);
router.use('/usuarios', usuarioRoutes_1.default);
router.use('/auth', authRoutes_1.default);
router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
exports.default = router;
