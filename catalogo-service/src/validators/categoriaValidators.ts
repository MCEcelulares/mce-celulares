import { z } from 'zod';

const nome = z.string().trim().min(1).max(255);
const algumCampo = (dados: object) => Object.keys(dados).length > 0;

export const criarCategoriaSchema = z.object({
  nome,
  icone: z.string().trim().max(255).nullable().optional(),
  ativo: z.boolean().default(true),
});

export const atualizarCategoriaSchema = criarCategoriaSchema
  .partial()
  .refine(algumCampo, { message: 'Informe ao menos um campo' });

export const criarMarcaSchema = z.object({
  nome,
  ativo: z.boolean().default(true),
});

export const atualizarMarcaSchema = criarMarcaSchema
  .partial()
  .refine(algumCampo, { message: 'Informe ao menos um campo' });
