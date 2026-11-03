import { z } from 'zod';

const semQuebraDeLinha = (valor: string) => valor.replace(/[\r\n]+/g, ' ');

export const contatoSchema = z.object({
  nome: z.string().trim().min(2).max(100).transform(semQuebraDeLinha),
  email: z.string().trim().toLowerCase().email().max(255),
  assunto: z.string().trim().max(150).transform(semQuebraDeLinha).optional(),
  telefone: z.string().trim().max(20).optional(),
  mensagem: z.string().trim().min(5).max(2000),
});
