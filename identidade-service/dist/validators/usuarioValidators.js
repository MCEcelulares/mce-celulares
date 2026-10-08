"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarUsuarioSchema = void 0;
const zod_1 = require("zod");
exports.criarUsuarioSchema = zod_1.z.object({
    nome: zod_1.z.string().min(2).max(255),
    email: zod_1.z.string().email(),
    senha: zod_1.z.string().min(6).max(72),
    cpf: zod_1.z.string().optional(),
    telefone: zod_1.z.string().optional(),
});
