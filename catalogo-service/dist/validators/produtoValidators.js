"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vitrineQuerySchema = exports.listarProdutosQuerySchema = exports.ajustarEstoqueSchema = exports.atualizarProdutoSchema = exports.criarProdutoSchema = void 0;
const zod_1 = require("zod");
const camposComuns_1 = require("./camposComuns");
const catalogo_1 = require("../config/catalogo");
const nome = zod_1.z.string().trim().min(2).max(255);
const descricao = zod_1.z.string().trim().max(5000);
exports.criarProdutoSchema = zod_1.z.object({
    nome,
    descricao: descricao.nullable().optional(),
    preco: camposComuns_1.precoSchema,
    estoque: zod_1.z.number().int().min(0).max(1000000).optional(),
    destaque: zod_1.z.boolean().optional(),
    ativo: zod_1.z.boolean().optional(),
    id_marca: camposComuns_1.idPositivoSchema,
    id_categoria: camposComuns_1.idPositivoSchema,
});
exports.atualizarProdutoSchema = zod_1.z
    .object({
    nome,
    descricao: descricao.nullable(),
    preco: camposComuns_1.precoSchema,
    destaque: zod_1.z.boolean(),
    ativo: zod_1.z.boolean(),
    id_marca: camposComuns_1.idPositivoSchema,
    id_categoria: camposComuns_1.idPositivoSchema,
})
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');
exports.ajustarEstoqueSchema = zod_1.z.object({
    ajuste: zod_1.z
        .number()
        .int()
        .refine((v) => v !== 0, 'O ajuste não pode ser zero')
        .refine((v) => Math.abs(v) <= 1000000, 'Ajuste grande demais'),
});
exports.listarProdutosQuerySchema = zod_1.z
    .object({
    categoria: camposComuns_1.idPositivoSchema.optional(),
    marca: camposComuns_1.idPositivoSchema.optional(),
    precoMin: zod_1.z.coerce.number().min(0).optional(),
    precoMax: zod_1.z.coerce.number().min(0).optional(),
    busca: zod_1.z.string().trim().max(100).optional(),
    disponivel: camposComuns_1.booleanoQuerySchema.optional(),
    incluirInativos: camposComuns_1.booleanoQuerySchema.optional(),
    ordenar: zod_1.z.enum(['recentes', 'preco_asc', 'preco_desc']).default('recentes'),
    pagina: zod_1.z.coerce.number().int().min(1).default(1),
    limite: zod_1.z.coerce.number().int().min(1).max(catalogo_1.limiteMaximoListagem).default(catalogo_1.limitePadraoListagem),
})
    .refine((q) => q.precoMin === undefined || q.precoMax === undefined || q.precoMin <= q.precoMax, { message: 'precoMin não pode ser maior que precoMax', path: ['precoMin'] });
exports.vitrineQuerySchema = zod_1.z.object({
    limite: zod_1.z.coerce.number().int().min(1).max(catalogo_1.limiteMaximoVitrine).default(catalogo_1.limitePadraoVitrine),
});
