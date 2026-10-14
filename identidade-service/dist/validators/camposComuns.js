"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.senhaSchema = exports.telefoneSchema = exports.cpfSchema = void 0;
const zod_1 = require("zod");
const cpf_1 = require("../utils/cpf");
const soDigitos = (valor) => valor.replace(/\D/g, '');
exports.cpfSchema = zod_1.z
    .string()
    .trim()
    .refine(cpf_1.cpfValido, 'CPF inválido')
    .transform(soDigitos);
exports.telefoneSchema = zod_1.z
    .string()
    .trim()
    .transform(soDigitos)
    .refine((v) => v.length === 10 || v.length === 11, 'Telefone inválido');
exports.senhaSchema = zod_1.z.string().min(6, 'Mínimo de 6 caracteres').max(72);
