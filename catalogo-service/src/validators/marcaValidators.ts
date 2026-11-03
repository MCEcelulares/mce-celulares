import { z } from 'zod';

const nome = z.string().trim().min(2).max(100);

export const criarMarcaSchema = z.object({
  nome,
  ativo: z.boolean().optional(),
});

export const atualizarMarcaSchema = z
  .object({ nome, ativo: z.boolean() })
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

export type CriarMarcaInput = z.infer<typeof criarMarcaSchema>;
export type AtualizarMarcaInput = z.infer<typeof atualizarMarcaSchema>;
