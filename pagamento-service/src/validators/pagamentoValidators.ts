import { z } from 'zod';
import { STATUS_PAGAMENTO } from '../models/statusPagamento';

export const registrarPagamentoSchema = z.object({
  idPedido: z.number().int().positive(),
  metodoPagamento: z.string().trim().min(1).max(50).transform((m) => m.toUpperCase()),
  valor: z.number().positive().max(99999999.99),
});

export const idPedidoParamSchema = z.object({ idPedido: z.coerce.number().int().positive() });

export const listarPagamentosQuerySchema = z.object({
  status: z.enum(STATUS_PAGAMENTO).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export type FiltrosPagamento = z.infer<typeof listarPagamentosQuerySchema>;

export type RegistrarPagamento = z.infer<typeof registrarPagamentoSchema>;
