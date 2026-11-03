"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consultarProdutosInternoSchema = exports.reservarEstoqueSchema = void 0;
const zod_1 = require("zod");
const camposComuns_1 = require("./camposComuns");
exports.reservarEstoqueSchema = zod_1.z.object({
    id_pedido: camposComuns_1.idPositivoSchema,
    itens: zod_1.z
        .array(zod_1.z.object({
        id_produto: camposComuns_1.idPositivoSchema,
        quantidade: zod_1.z.number().int().min(1).max(1000),
    }))
        .min(1, 'Informe ao menos um item')
        .max(100)
        .refine((itens) => new Set(itens.map((i) => i.id_produto)).size === itens.length, 'Há produtos repetidos na lista: some as quantidades antes de reservar'),
});
exports.consultarProdutosInternoSchema = zod_1.z.object({
    ids: zod_1.z
        .string()
        .transform((valor) => valor.split(',').map((id) => Number(id.trim())))
        .refine((ids) => ids.length > 0 && ids.length <= 100 && ids.every((id) => Number.isInteger(id) && id > 0), 'Informe até 100 ids inteiros positivos separados por vírgula'),
});
