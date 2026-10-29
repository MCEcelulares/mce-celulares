import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

export const registro = new client.Registry();
registro.setDefaultLabels({ servico: 'catalogo-service' });
client.collectDefaultMetrics({ register: registro });

const requisicoes = new client.Counter({
  name: 'http_requisicoes_total',
  help: 'Total de requisições HTTP',
  labelNames: ['metodo', 'rota', 'status'],
  registers: [registro],
});

const duracao = new client.Histogram({
  name: 'http_requisicao_duracao_segundos',
  help: 'Duração das requisições HTTP',
  labelNames: ['metodo', 'rota', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registro],
});

const eventos = new client.Counter({
  name: 'catalogo_eventos_total',
  help: 'Eventos de negócio do Catálogo (produto criado, reserva de estoque, devolução...)',
  labelNames: ['evento'],
  registers: [registro],
});

const cache = new client.Counter({
  name: 'catalogo_cache_total',
  help: 'Resultado das consultas ao cache Redis (hit, miss, erro)',
  labelNames: ['resultado'],
  registers: [registro],
});

export function registrarEvento(evento: string) {
  eventos.inc({ evento });
}

export function registrarCache(resultado: 'hit' | 'miss' | 'erro') {
  cache.inc({ resultado });
}

function rotulo(req: Request): string {
  if (!req.route) return 'nao_encontrada';
  return `${req.baseUrl}${req.route.path}`.replace(/\/\d+/g, '/:id').replace(/\/$/, '') || '/';
}

export function medirRequisicao(req: Request, res: Response, next: NextFunction) {
  const fim = duracao.startTimer();
  res.on('finish', () => {
    const labels = { metodo: req.method, rota: rotulo(req), status: String(res.statusCode) };
    requisicoes.inc(labels);
    fim(labels);
  });
  next();
}
