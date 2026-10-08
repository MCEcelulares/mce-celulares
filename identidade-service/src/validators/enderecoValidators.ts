import { z } from 'zod';

export const criarEnderecoSchema = z.object({
  endereco: z.string().min(2).max(255),
  numero: z.string().min(1).max(255),
  complemento: z.string().max(255).optional(),
  bairro: z.string().max(255).optional(),
  cidade: z.string().min(2).max(255),
  estado: z.string().length(2),
  cep: z.string().min(8).max(255),
  principal: z.boolean().optional(),
});

export type CriarEnderecoInput = z.infer<typeof criarEnderecoSchema>;
