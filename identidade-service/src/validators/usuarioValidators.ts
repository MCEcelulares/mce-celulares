import { z } from 'zod';

export const criarUsuarioSchema = z.object({
  nome: z.string().min(2).max(255),
  email: z.string().email(),
  senha: z.string().min(6).max(72), 
  cpf: z.string().optional(),
  telefone: z.string().optional(),
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
