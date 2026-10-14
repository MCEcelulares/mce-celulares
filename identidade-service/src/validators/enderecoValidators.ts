import { z } from 'zod';

const cepSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 8, 'CEP inválido');

export const criarEnderecoSchema = z.object({
  endereco: z.string().trim().min(2).max(255),
  numero: z.string().trim().min(1).max(255),
  complemento: z.string().trim().max(255).optional(),
  bairro: z.string().trim().max(255).optional(),
  cidade: z.string().trim().min(2).max(255),
  estado: z.string().trim().length(2).toUpperCase(),
  cep: cepSchema,
  principal: z.boolean().optional(),
});

export const atualizarEnderecoSchema = criarEnderecoSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

export type CriarEnderecoInput = z.infer<typeof criarEnderecoSchema>;
export type AtualizarEnderecoInput = z.infer<typeof atualizarEnderecoSchema>;
