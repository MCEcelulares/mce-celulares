import pino from 'pino';
import 'dotenv/config';
import { contextoRequisicao } from './contexto';

const saidaLegivel = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { servico: 'catalogo-service' },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => ({ idCorrelacao: contextoRequisicao.getStore()?.idCorrelacao }),
  redact: ['req.headers.authorization'],
  transport: saidaLegivel ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});