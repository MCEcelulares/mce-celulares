"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.definirCargosSchema = exports.listarUsuariosQuerySchema = exports.alterarSenhaSchema = exports.alterarStatusSchema = exports.atualizarUsuarioAdminSchema = exports.atualizarPerfilSchema = exports.criarUsuarioSchema = void 0;
const zod_1 = require("zod");
const camposComuns_1 = require("./camposComuns");
exports.criarUsuarioSchema = zod_1.z.object({
    nome: zod_1.z.string().trim().min(2).max(255),
    email: zod_1.z.string().trim().toLowerCase().email(),
    senha: camposComuns_1.senhaSchema,
    cpf: camposComuns_1.cpfSchema,
    telefone: camposComuns_1.telefoneSchema,
});
exports.atualizarPerfilSchema = zod_1.z
    .object({
    nome: zod_1.z.string().trim().min(2).max(255),
    cpf: camposComuns_1.cpfSchema,
    telefone: camposComuns_1.telefoneSchema,
})
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, "Informe ao menos um campo");
exports.atualizarUsuarioAdminSchema = zod_1.z
    .object({
    nome: zod_1.z.string().trim().min(2).max(255),
    email: zod_1.z.string().trim().toLowerCase().email(),
    cpf: camposComuns_1.cpfSchema,
    telefone: camposComuns_1.telefoneSchema,
})
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, "Informe ao menos um campo");
exports.alterarStatusSchema = zod_1.z.object({ ativo: zod_1.z.boolean() });
exports.alterarSenhaSchema = zod_1.z
    .object({
    senhaAtual: zod_1.z.string().min(1),
    novaSenha: camposComuns_1.senhaSchema,
})
    .refine((d) => d.senhaAtual !== d.novaSenha, {
    message: "A nova senha deve ser diferente da atual",
    path: ["novaSenha"],
});
exports.listarUsuariosQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    busca: zod_1.z.string().trim().min(1).optional(),
    cargo: zod_1.z.string().trim().min(1).optional(),
    ativo: zod_1.z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .optional(),
});
exports.definirCargosSchema = zod_1.z.object({
    cargos: zod_1.z.array(zod_1.z.string().trim().min(1)).min(1).max(10),
});
