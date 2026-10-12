"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atualizarPermissaoSchema = exports.criarPermissaoSchema = exports.definirPermissoesDoCargoSchema = exports.atualizarCargoSchema = exports.criarCargoSchema = void 0;
const zod_1 = require("zod");
const nomeCargo = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Use apenas letras minúsculas, números, - e _');
const nomePermissao = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'Use o formato recurso:acao (ex.: produtos:gerenciar)');
exports.criarCargoSchema = zod_1.z.object({
    nome: nomeCargo,
    permissoes: zod_1.z.array(nomePermissao).max(50).optional(),
});
exports.atualizarCargoSchema = zod_1.z.object({ nome: nomeCargo });
exports.definirPermissoesDoCargoSchema = zod_1.z.object({
    permissoes: zod_1.z.array(nomePermissao).max(50),
});
exports.criarPermissaoSchema = zod_1.z.object({ nome: nomePermissao });
exports.atualizarPermissaoSchema = zod_1.z.object({ nome: nomePermissao });
