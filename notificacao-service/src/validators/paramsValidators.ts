import { z } from 'zod';

export const idPedidoParamSchema = z.object({ idPedido: z.coerce.number().int().positive() });
