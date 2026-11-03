import { z } from 'zod';
import { booleanoQuerySchema } from './camposComuns';

const nome = z.string().trim().min(2).max(100);
const icone = z.string().trim().max(255);

export const criarCategoriaSchema = z.object({
  nome,
  icone: icone.nullable().optional(),
  ativo: z.boolean().optional(),
});

export const atualizarCategoriaSchema = z
  .object({ nome, icone: icone.nullable(), ativo: z.boolean() })
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

export const listarCadastrosQuerySchema = z.object({
  incluirInativos: booleanoQuerySchema.optional(),
});

export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;
export type AtualizarCategoriaInput = z.infer<typeof atualizarCategoriaSchema>;
