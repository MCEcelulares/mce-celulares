import { z } from 'zod';

const nomeCargo = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9_-]+$/, 'Use apenas letras minúsculas, números, - e _');

const nomePermissao = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'Use o formato recurso:acao (ex.: produtos:gerenciar)');

export const criarCargoSchema = z.object({
  nome: nomeCargo,
  permissoes: z.array(nomePermissao).max(50).optional(),
});

export const atualizarCargoSchema = z.object({ nome: nomeCargo });

export const definirPermissoesDoCargoSchema = z.object({
  permissoes: z.array(nomePermissao).max(50),
});

export const criarPermissaoSchema = z.object({ nome: nomePermissao });
export const atualizarPermissaoSchema = z.object({ nome: nomePermissao });

export type CriarCargoInput = z.infer<typeof criarCargoSchema>;
