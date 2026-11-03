import { z } from 'zod';
import { idPositivoSchema } from './camposComuns';

export const reservarEstoqueSchema = z.object({
  id_pedido: idPositivoSchema,
  itens: z
    .array(
      z.object({
        id_produto: idPositivoSchema,
        quantidade: z.number().int().min(1).max(1000),
      })
    )
    .min(1, 'Informe ao menos um item')
    .max(100)
    .refine(
      (itens) => new Set(itens.map((i) => i.id_produto)).size === itens.length,
      'Há produtos repetidos na lista: some as quantidades antes de reservar'
    ),
});

export const consultarProdutosInternoSchema = z.object({
  ids: z
    .string()
    .transform((valor) => valor.split(',').map((id) => Number(id.trim())))
    .refine(
      (ids) => ids.length > 0 && ids.length <= 100 && ids.every((id) => Number.isInteger(id) && id > 0),
      'Informe até 100 ids inteiros positivos separados por vírgula'
    ),
});

export type ReservarEstoqueInput = z.infer<typeof reservarEstoqueSchema>;
