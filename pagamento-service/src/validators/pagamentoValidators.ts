import { z } from 'zod';

export const registrarPagamentoSchema = z.object({
  idPedido: z.number().int().positive(),
  metodoPagamento: z.string().trim().min(1).max(50).transform((m) => m.toUpperCase()),
  valor: z.number().positive().max(99999999.99),
});

export const idPedidoParamSchema = z.object({ idPedido: z.coerce.number().int().positive() });

export type RegistrarPagamento = z.infer<typeof registrarPagamentoSchema>;
