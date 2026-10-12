import { z } from "zod";
import { cpfSchema, telefoneSchema, senhaSchema } from "./camposComuns";

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email(),
  senha: senhaSchema,
  cpf: cpfSchema,
  telefone: telefoneSchema,
});

export const atualizarPerfilSchema = z
  .object({
    nome: z.string().trim().min(2).max(255),
    cpf: cpfSchema,
    telefone: telefoneSchema,
  })
  .partial()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    "Informe ao menos um campo",
  );

export const atualizarUsuarioAdminSchema = z
  .object({
    nome: z.string().trim().min(2).max(255),
    email: z.string().trim().toLowerCase().email(),
    cpf: cpfSchema,
    telefone: telefoneSchema,
  })
  .partial()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    "Informe ao menos um campo",
  );

export const alterarStatusSchema = z.object({ ativo: z.boolean() });

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1),
    novaSenha: senhaSchema,
  })
  .refine((d) => d.senhaAtual !== d.novaSenha, {
    message: "A nova senha deve ser diferente da atual",
    path: ["novaSenha"],
  });

export const listarUsuariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().trim().min(1).optional(),
  cargo: z.string().trim().min(1).optional(),
  ativo: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const definirCargosSchema = z.object({
  cargos: z.array(z.string().trim().min(1)).min(1).max(10),
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuarioAdminInput = z.infer<
  typeof atualizarUsuarioAdminSchema
>;
export type AtualizarPerfilInput = z.infer<typeof atualizarPerfilSchema>;
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>;
