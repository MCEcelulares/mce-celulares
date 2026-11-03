"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarCadastrosQuerySchema = exports.atualizarCategoriaSchema = exports.criarCategoriaSchema = void 0;
const zod_1 = require("zod");
const camposComuns_1 = require("./camposComuns");
const nome = zod_1.z.string().trim().min(2).max(100);
const icone = zod_1.z.string().trim().max(255);
exports.criarCategoriaSchema = zod_1.z.object({
    nome,
    icone: icone.nullable().optional(),
    ativo: zod_1.z.boolean().optional(),
});
exports.atualizarCategoriaSchema = zod_1.z
    .object({ nome, icone: icone.nullable(), ativo: zod_1.z.boolean() })
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');
exports.listarCadastrosQuerySchema = zod_1.z.object({
    incluirInativos: camposComuns_1.booleanoQuerySchema.optional(),
});
