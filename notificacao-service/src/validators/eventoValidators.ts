import { z } from 'zod';

// Contrato definido no ADR-008.
const cliente = z.object({
  nome: z.string().min(1).max(255),
  email: z.string().email().max(255),
});

export const envelopeSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  versao: z.number().int(),
  origem: z.string().min(1),
  ocorridoEm: z.string().datetime(),
  dados: z.unknown(),
});

export const pedidoCriadoSchema = z.object({
  idPedido: z.number().int().positive(),
  status: z.string(),
  valorTotal: z.number(),
  cliente,
});

export const pagamentoConfirmadoSchema = z.object({
  idPedido: z.number().int().positive(),
  valor: z.number(),
  metodoPagamento: z.string(),
  cliente,
});

export type PedidoCriado = z.infer<typeof pedidoCriadoSchema>;
export type PagamentoConfirmado = z.infer<typeof pagamentoConfirmadoSchema>;
