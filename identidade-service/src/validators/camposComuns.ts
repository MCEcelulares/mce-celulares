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

export const senhaSchema = z.string().min(6, 'Mínimo de 6 caracteres').max(72); 
