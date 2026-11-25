import { z } from 'zod';
import { cpfValido } from '../utils/cpf';

const soDigitos = (valor: string) => valor.replace(/\D/g, '');

export const cpfSchema = z
  .string()
  .trim()
  .refine(cpfValido, 'CPF inválido')
  .transform(soDigitos);

export const telefoneSchema = z
  .string()
  .trim()
  .transform(soDigitos)
  .refine((v) => v.length === 10 || v.length === 11, 'Telefone inválido');

export const senhaSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[a-z]/, 'Use ao menos uma letra minúscula')
  .regex(/[A-Z]/, 'Use ao menos uma letra maiúscula')
  .regex(/\d/, 'Use ao menos um número');

const FORMATO_EMAIL = /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]+(?<!\.)@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo')
  .regex(FORMATO_EMAIL, 'E-mail inválido');
