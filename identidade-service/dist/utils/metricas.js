"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registro = void 0;
exports.registrarEvento = registrarEvento;
exports.medirRequisicao = medirRequisicao;
const prom_client_1 = __importDefault(require("prom-client"));
exports.registro = new prom_client_1.default.Registry();
exports.registro.setDefaultLabels({ servico: 'identidade-service' });
prom_client_1.default.collectDefaultMetrics({ register: exports.registro });
const requisicoes = new prom_client_1.default.Counter({
    name: 'http_requisicoes_total',
    help: 'Total de requisições HTTP',
    labelNames: ['metodo', 'rota', 'status'],
    registers: [exports.registro],
});
const duracao = new prom_client_1.default.Histogram({
    name: 'http_requisicao_duracao_segundos',
    help: 'Duração das requisições HTTP',
    labelNames: ['metodo', 'rota', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [exports.registro],
});
const eventos = new prom_client_1.default.Counter({
    name: 'identidade_eventos_total',
    help: 'Eventos de negócio do Identidade (login, cadastro, refresh...)',
    labelNames: ['evento'],
    registers: [exports.registro],
});
function registrarEvento(evento) {
    eventos.inc({ evento });
}
function rotulo(req) {
    if (!req.route)
        return 'nao_encontrada';
    return `${req.baseUrl}${req.route.path}`.replace(/\/\d+/g, '/:id').replace(/\/$/, '') || '/';
}
function medirRequisicao(req, res, next) {
    const fim = duracao.startTimer();
    res.on('finish', () => {
        const labels = { metodo: req.method, rota: rotulo(req), status: String(res.statusCode) };
        requisicoes.inc(labels);
        fim(labels);
    });
    next();
}
