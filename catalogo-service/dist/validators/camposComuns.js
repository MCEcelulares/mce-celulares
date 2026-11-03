"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.precoSchema = exports.booleanoQuerySchema = exports.idPositivoSchema = void 0;
const zod_1 = require("zod");
exports.idPositivoSchema = zod_1.z.coerce.number().int().positive();
exports.booleanoQuerySchema = zod_1.z.enum(['true', 'false']).transform((v) => v === 'true');
exports.precoSchema = zod_1.z
    .number()
    .positive('O preço deve ser maior que zero')
    .max(99999999.99)
    .refine((v) => Math.round(v * 100) / 100 === v, 'Use no máximo 2 casas decimais');
