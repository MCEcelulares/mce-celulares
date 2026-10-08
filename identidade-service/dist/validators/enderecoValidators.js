"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarEnderecoSchema = void 0;
const zod_1 = require("zod");
exports.criarEnderecoSchema = zod_1.z.object({
    endereco: zod_1.z.string().min(2).max(255),
    numero: zod_1.z.string().min(1).max(255),
    complemento: zod_1.z.string().max(255).optional(),
    bairro: zod_1.z.string().max(255).optional(),
    cidade: zod_1.z.string().min(2).max(255),
    estado: zod_1.z.string().length(2),
    cep: zod_1.z.string().min(8).max(255),
    principal: zod_1.z.boolean().optional(),
});
