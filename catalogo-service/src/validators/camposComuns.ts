import { z } from 'zod';

export const idPositivoSchema = z.coerce.number().int().positive();

export const booleanoQuerySchema = z.enum(['true', 'false']).transform((v) => v === 'true');

export const precoSchema = z
  .number()
  .positive('O preço deve ser maior que zero')
  .max(99999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, 'Use no máximo 2 casas decimais');
