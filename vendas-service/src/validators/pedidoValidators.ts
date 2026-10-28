import { z } from 'zod';
import { STATUS_PEDIDO } from '../models/statusPedido';

export const criarPedidoSchema = z.object({
  idEndereco: z.number().int().positive(),
});

export const listarPedidosQuerySchema = z.object({
  status: z.enum(STATUS_PEDIDO).optional(),
  todos: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const atualizarStatusSchema = z.object({
  status: z.enum(STATUS_PEDIDO),
});

export type FiltrosPedido = z.infer<typeof listarPedidosQuerySchema>;
