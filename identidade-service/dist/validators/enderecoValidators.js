"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atualizarEnderecoSchema = exports.criarEnderecoSchema = void 0;
const zod_1 = require("zod");
const cepSchema = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 8, 'CEP inválido');
exports.criarEnderecoSchema = zod_1.z.object({
    endereco: zod_1.z.string().trim().min(2).max(255),
    numero: zod_1.z.string().trim().min(1).max(255),
    complemento: zod_1.z.string().trim().max(255).optional(),
    bairro: zod_1.z.string().trim().max(255).optional(),
    cidade: zod_1.z.string().trim().min(2).max(255),
    estado: zod_1.z.string().trim().length(2).toUpperCase(),
    cep: cepSchema,
    principal: zod_1.z.boolean().optional(),
});
exports.atualizarEnderecoSchema = exports.criarEnderecoSchema
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');
