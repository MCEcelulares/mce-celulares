import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

export const registro = new client.Registry();
registro.setDefaultLabels({ servico: 'notificacao-service' });
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
  name: 'notificacao_eventos_total',
  help: 'Eventos de negócio do Notificação (email_enviado, email_falha, evento_duplicado, contato_enviado...)',
  labelNames: ['evento'],
  registers: [registro],
});

const entrega = new client.Histogram({
  name: 'notificacao_entrega_segundos',
  help: 'Tempo entre a publicação do evento e o envio do e-mail (SLO 4: p95 < 10s)',
  labelNames: ['tipo'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [registro],
});

export function registrarEvento(evento: string) {
  eventos.inc({ evento });
}

export function registrarEntrega(tipo: string, ocorridoEm: string) {
  const segundos = (Date.now() - new Date(ocorridoEm).getTime()) / 1000;
  if (Number.isFinite(segundos) && segundos >= 0) entrega.observe({ tipo }, segundos);
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
