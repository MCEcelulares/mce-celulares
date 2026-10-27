import { z } from 'zod';

const idPositivo = z.number().int().positive();
const idOpcional = z.coerce.number().int().positive().optional();

export const listarProdutosQuerySchema = z
  .object({
    categoria: idOpcional,
    marca: idOpcional,
    precoMin: z.coerce.number().min(0).optional(),
    precoMax: z.coerce.number().min(0).optional(),
    busca: z.string().trim().min(1).max(100).optional(),
    disponivel: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    ordenar: z.enum(['recentes', 'preco_asc', 'preco_desc']).default('recentes'),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((q) => q.precoMin === undefined || q.precoMax === undefined || q.precoMin <= q.precoMax, {
    message: 'precoMin não pode ser maior que precoMax',
    path: ['precoMin'],
  });

export const limiteQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

export const criarProdutoSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  descricao: z.string().trim().max(5000).nullable().optional(),
  preco: z.number().positive().max(99999999.99).multipleOf(0.01),
  estoque: z.number().int().min(0).max(1_000_000).default(0),
  imagem: z.string().trim().max(255).nullable().optional(),
  destaque: z.boolean().default(false),
  ativo: z.boolean().default(true),
  peso: z.number().positive().max(999.999).nullable().optional(),
  altura: z.number().positive().max(9999.99).nullable().optional(),
  largura: z.number().positive().max(9999.99).nullable().optional(),
  comprimento: z.number().positive().max(9999.99).nullable().optional(),
  id_marca: idPositivo,
  id_categoria: idPositivo,
});

export const atualizarProdutoSchema = criarProdutoSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo' });

export const baixaEstoqueSchema = z.object({
  quantidade: z.number().int().min(1).max(1_000_000),
});

export type FiltrosProduto = z.infer<typeof listarProdutosQuerySchema>;
export type CriarProduto = z.infer<typeof criarProdutoSchema>;
export type AtualizarProduto = z.infer<typeof atualizarProdutoSchema>;
