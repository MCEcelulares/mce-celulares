import { z } from 'zod';
import { booleanoQuerySchema, idPositivoSchema, precoSchema } from './camposComuns';
import {
  limiteMaximoListagem,
  limiteMaximoVitrine,
  limitePadraoListagem,
  limitePadraoVitrine,
} from '../config/catalogo';

const nome = z.string().trim().min(2).max(255);
const descricao = z.string().trim().max(5000);

export const criarProdutoSchema = z.object({
  nome,
  descricao: descricao.nullable().optional(),
  preco: precoSchema,
  estoque: z.number().int().min(0).max(1000000).optional(),
  destaque: z.boolean().optional(),
  ativo: z.boolean().optional(),
  id_marca: idPositivoSchema,
  id_categoria: idPositivoSchema,
});

export const atualizarProdutoSchema = z
  .object({
    nome,
    descricao: descricao.nullable(),
    preco: precoSchema,
    destaque: z.boolean(),
    ativo: z.boolean(),
    id_marca: idPositivoSchema,
    id_categoria: idPositivoSchema,
  })
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo');

export const ajustarEstoqueSchema = z.object({
  ajuste: z
    .number()
    .int()
    .refine((v) => v !== 0, 'O ajuste não pode ser zero')
    .refine((v) => Math.abs(v) <= 1000000, 'Ajuste grande demais'),
});

export const listarProdutosQuerySchema = z
  .object({
    categoria: idPositivoSchema.optional(),
    marca: idPositivoSchema.optional(),
    precoMin: z.coerce.number().min(0).optional(),
    precoMax: z.coerce.number().min(0).optional(),
    busca: z.string().trim().max(100).optional(),
    disponivel: booleanoQuerySchema.optional(),
    incluirInativos: booleanoQuerySchema.optional(),
    ordenar: z.enum(['recentes', 'preco_asc', 'preco_desc']).default('recentes'),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(limiteMaximoListagem).default(limitePadraoListagem),
  })
  .refine(
    (q) => q.precoMin === undefined || q.precoMax === undefined || q.precoMin <= q.precoMax,
    { message: 'precoMin não pode ser maior que precoMax', path: ['precoMin'] }
  );

export const vitrineQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(limiteMaximoVitrine).default(limitePadraoVitrine),
});

export type CriarProdutoInput = z.infer<typeof criarProdutoSchema>;
export type AtualizarProdutoInput = z.infer<typeof atualizarProdutoSchema>;
export type ListarProdutosQuery = z.infer<typeof listarProdutosQuerySchema>;
