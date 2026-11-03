"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atualizarMarcaSchema = exports.criarMarcaSchema = void 0;
const zod_1 = require("zod");
const nome = zod_1.z.string().trim().min(2).max(100);
exports.criarMarcaSchema = zod_1.z.object({
    nome,
    ativo: zod_1.z.boolean().optional(),
});
exports.atualizarMarcaSchema = zod_1.z
    .object({ nome, ativo: zod_1.z.boolean() })
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');
