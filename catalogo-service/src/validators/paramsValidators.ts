import { z } from 'zod';

const idPositivo = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id: idPositivo });
