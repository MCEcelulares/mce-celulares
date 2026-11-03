import { z } from 'zod';

const quantidade = z.number().int().min(1).max(99);

export const adicionarItemSchema = z.object({
  idProduto: z.number().int().positive(),
  quantidade,
});

export const atualizarItemSchema = z.object({ quantidade });
