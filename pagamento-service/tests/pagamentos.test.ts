import request from 'supertest';
import { Op, UniqueConstraintError } from 'sequelize';
import { app } from '../src/app';
import { redis } from '../src/config/redis';
import { Pagamento } from '../src/models';
import * as vendas from '../src/clients/vendasClient';
import { obterGateway } from '../src/gateways';
import { ErroHttp } from '../src/middlewares/errorHandler';
import { tokenDe, bearer, pedidoVendas, pagamentoCom } from './helpers';

const api = request(app);
const pagamentoMock = Pagamento as unknown as Record<string, jest.Mock>;
const buscarPedido = vendas.buscarPedido as jest.Mock;
const atualizarStatus = vendas.atualizarStatus as jest.Mock;
const obterGatewayMock = obterGateway as jest.Mock;

const cliente = bearer(tokenDe(5));
const outroCliente = bearer(tokenDe(6));
const admin = bearer(tokenDe(1, ['pedidos:listar-todos']));
const corpo = { idPedido: 77, metodoPagamento: 'pix', valor: 125 };

let gateway: {
  nome: string;
  iniciar: jest.Mock;
  consultarPagamento: jest.Mock;
  buscarPagamentosPorReferencia: jest.Mock;
};
let publicar: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  gateway = {
    nome: 'fake',
    iniciar: jest.fn(),
    consultarPagamento: jest.fn(),
    buscarPagamentosPorReferencia: jest.fn(),
  };
  obterGatewayMock.mockReturnValue(gateway);
  publicar = jest.spyOn(redis, 'publish');
});

afterEach(() => publicar.mockRestore());

describe('POST /pagamentos', () => {
  beforeEach(() => {
    buscarPedido.mockResolvedValue(pedidoVendas());
    pagamentoMock.findOne.mockResolvedValue(null);
    pagamentoMock.create.mockImplementation(async (dados) => pagamentoCom({ ...dados, valor: String(dados.valor) }));
    pagamentoMock.update.mockResolvedValue([1]);
    atualizarStatus.mockResolvedValue(pedidoVendas({ status: 'PAGO' }));
  });

  describe('com gateway que aprova na hora (simulado)', () => {
    beforeEach(() => {
      gateway.iniciar.mockResolvedValue({ idExterno: null, urlPagamento: null, aprovadoNaHora: true });
    });

    it('confirma: marca o pedido como PAGO no Vendas, aprova o pagamento e publica pagamento.confirmado', async () => {
      const r = await api.post('/pagamentos').set(cliente).send(corpo);

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ id_pedido: 77, metodo_pagamento: 'PIX', valor: 125, status: 'APROVADO' });

      expect(buscarPedido).toHaveBeenCalledWith(77);
      expect(pagamentoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ id_pedido: 77, id_usuario: 5, metodo_pagamento: 'PIX', valor: 125, status: 'PENDENTE' })
      );
      expect(atualizarStatus).toHaveBeenCalledWith(77, 'PAGO');
      expect(pagamentoMock.update.mock.calls[0][0]).toMatchObject({ status: 'APROVADO' });
      // só quem muda de não-APROVADO para APROVADO publica o evento (evita duplicata em webhooks repetidos)
      expect(pagamentoMock.update.mock.calls[0][1].where).toEqual({ id_pagamento: 1, status: { [Op.ne]: 'APROVADO' } });

      const [canal, mensagem] = publicar.mock.calls[0];
      const evento = JSON.parse(mensagem);
      expect(canal).toBe('pagamento.confirmado');
      expect(evento).toMatchObject({
        tipo: 'pagamento.confirmado',
        versao: 1,
        origem: 'pagamento-service',
        dados: {
          idPedido: 77,
          valor: 125,
          metodoPagamento: 'PIX',
          cliente: { nome: 'Rafael', email: 'rafael@mce.test' },
        },
      });
      expect(evento.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(evento)).not.toMatch(/45999990000/); // sem telefone
    });

    it('envia ao gateway os itens, o e-mail e o frete do pedido', async () => {
      await api.post('/pagamentos').set(cliente).send(corpo);
      expect(gateway.iniciar).toHaveBeenCalledWith({
        idPedido: 77,
        valor: 125,
        emailCliente: 'rafael@mce.test',
        valorFrete: 0,
        expiraEm: '2026-10-28T12:30:00.000Z',
        itens: [
          { id: '10', titulo: 'iPhone 15', quantidade: 2, precoUnitario: 12.5 },
          { id: '11', titulo: 'Capa', quantidade: 1, precoUnitario: 100 },
        ],
      });
    });

    it('continua aprovando se a publicação do evento falhar', async () => {
      publicar.mockRejectedValueOnce(new Error('redis fora do ar'));
      expect((await api.post('/pagamentos').set(cliente).send(corpo)).status).toBe(201);
    });

    it('não publica o evento duas vezes se outra chamada já confirmou (reivindicação atômica)', async () => {
      pagamentoMock.update.mockResolvedValue([0]);
      const r = await api.post('/pagamentos').set(cliente).send(corpo);
      expect(r.status).toBe(201);
      expect(publicar).not.toHaveBeenCalled();
    });

    it('devolve o erro do Vendas se ele recusar o pagamento e não aprova nada', async () => {
      atualizarStatus.mockRejectedValue(new ErroHttp(409, 'O pedido não pode mais receber este pagamento'));
      const r = await api.post('/pagamentos').set(cliente).send(corpo);
      expect(r.status).toBe(409);
      expect(pagamentoMock.update).not.toHaveBeenCalled();
      expect(publicar).not.toHaveBeenCalled();
    });
  });

  describe('com gateway de página externa (Mercado Pago)', () => {
    beforeEach(() => {
      gateway.iniciar.mockResolvedValue({ idExterno: 'pref-1', urlPagamento: 'https://mp.test/checkout/pref-1', aprovadoNaHora: false });
    });

    it('devolve o link de pagamento e deixa o pagamento PENDENTE até o webhook', async () => {
      const r = await api.post('/pagamentos').set(cliente).send(corpo);

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ status: 'PENDENTE', url_pagamento: 'https://mp.test/checkout/pref-1' });
      expect(atualizarStatus).not.toHaveBeenCalled();
      expect(publicar).not.toHaveBeenCalled();
    });

    it('repetir a chamada devolve o mesmo link, sem criar outra cobrança', async () => {
      pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ url_pagamento: 'https://mp.test/checkout/pref-1' }));
      const r = await api.post('/pagamentos').set(cliente).send(corpo);
      expect(r.status).toBe(201);
      expect(r.body.url_pagamento).toBe('https://mp.test/checkout/pref-1');
      expect(gateway.iniciar).not.toHaveBeenCalled();
      expect(pagamentoMock.create).not.toHaveBeenCalled();
    });

    it('permite nova tentativa depois de um pagamento RECUSADO', async () => {
      const recusado = pagamentoCom({ status: 'RECUSADO', url_pagamento: 'https://mp.test/antigo' });
      pagamentoMock.findOne.mockResolvedValue(recusado);

      const r = await api.post('/pagamentos').set(cliente).send(corpo);

      expect(r.status).toBe(201);
      expect(recusado.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDENTE', url_pagamento: null }));
      expect(gateway.iniciar).toHaveBeenCalledTimes(1);
      expect(pagamentoMock.create).not.toHaveBeenCalled();
    });

    it('refaz a cobrança se o pagamento ficou PENDENTE sem link (falha anterior)', async () => {
      pagamentoMock.findOne.mockResolvedValue(pagamentoCom());
      await api.post('/pagamentos').set(cliente).send(corpo);
      expect(gateway.iniciar).toHaveBeenCalledTimes(1);
    });
  });

  it('recusa quando o pedido já foi pago', async () => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ status: 'APROVADO' }));
    const r = await api.post('/pagamentos').set(cliente).send(corpo);
    expect(r.status).toBe(409);
    expect(gateway.iniciar).not.toHaveBeenCalled();
  });

  it('responde 404 quando o pedido não existe', async () => {
    buscarPedido.mockResolvedValue(null);
    expect((await api.post('/pagamentos').set(cliente).send(corpo)).status).toBe(404);
    expect(pagamentoMock.create).not.toHaveBeenCalled();
  });

  it('responde 403 quando o pedido é de outro usuário', async () => {
    const r = await api.post('/pagamentos').set(outroCliente).send(corpo);
    expect(r.status).toBe(403);
    expect(gateway.iniciar).not.toHaveBeenCalled();
  });

  it.each(['PAGO', 'CANCELADO', 'ENVIADO'])('responde 409 quando o pedido está %s', async (status) => {
    buscarPedido.mockResolvedValue(pedidoVendas({ status }));
    const r = await api.post('/pagamentos').set(cliente).send(corpo);
    expect(r.status).toBe(409);
    expect(gateway.iniciar).not.toHaveBeenCalled();
  });

  it('responde 422 quando o valor não confere com o pedido (inclusive por centavos)', async () => {
    for (const valor of [124.99, 125.01, 100, 250]) {
      const r = await api.post('/pagamentos').set(cliente).send({ ...corpo, valor });
      expect(r.status).toBe(422);
    }
    expect(pagamentoMock.create).not.toHaveBeenCalled();
    expect(gateway.iniciar).not.toHaveBeenCalled();
  });

  it('responde 503 sem criar nada se o gateway não estiver configurado', async () => {
    obterGatewayMock.mockImplementation(() => {
      throw new ErroHttp(503, 'Gateway de pagamento não configurado');
    });
    const r = await api.post('/pagamentos').set(cliente).send(corpo);
    expect(r.status).toBe(503);
    expect(pagamentoMock.create).not.toHaveBeenCalled();
  });

  it('responde 503 se o Vendas estiver fora do ar', async () => {
    buscarPedido.mockRejectedValue(new ErroHttp(503, 'Vendas indisponível no momento'));
    expect((await api.post('/pagamentos').set(cliente).send(corpo)).status).toBe(503);
  });

  it('responde 409 numa corrida entre dois pagamentos do mesmo pedido', async () => {
    pagamentoMock.create.mockRejectedValue(new UniqueConstraintError({}));
    expect((await api.post('/pagamentos').set(cliente).send(corpo)).status).toBe(409);
  });

  it('exige token e dados válidos', async () => {
    expect((await api.post('/pagamentos').send(corpo)).status).toBe(401);
    for (const invalido of [
      { ...corpo, valor: -5 },
      { ...corpo, valor: 0 },
      { ...corpo, idPedido: 'x' },
      { ...corpo, metodoPagamento: '' },
      { idPedido: 77 },
    ]) {
      expect((await api.post('/pagamentos').set(cliente).send(invalido)).status).toBe(400);
    }
    expect(buscarPedido).not.toHaveBeenCalled();
  });
});

describe('GET /pagamentos/:idPedido', () => {
  it('mostra o pagamento ao dono, sem dados internos do gateway', async () => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ id_externo: 'pref-1' }));
    const r = await api.get('/pagamentos/77').set(cliente);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id_pedido: 77, status: 'PENDENTE', valor: 125 });
    expect(r.body.id_externo).toBeUndefined();
    expect(r.body.id_usuario).toBeUndefined();
  });

  it('nega a outro usuário e libera a quem tem pedidos:listar-todos', async () => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom());
    expect((await api.get('/pagamentos/77').set(outroCliente)).status).toBe(403);
    expect((await api.get('/pagamentos/77').set(admin)).status).toBe(200);
  });

  it('responde 404 sem pagamento, 400 com id inválido e 401 sem token', async () => {
    pagamentoMock.findOne.mockResolvedValue(null);
    expect((await api.get('/pagamentos/99').set(cliente)).status).toBe(404);
    expect((await api.get('/pagamentos/abc').set(cliente)).status).toBe(400);
    expect((await api.get('/pagamentos/77')).status).toBe(401);
  });
});

describe('POST /pagamentos/webhook (Mercado Pago)', () => {
  const aprovado = { status: 'approved', externalReference: '77', valor: 125 };

  beforeEach(() => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ url_pagamento: 'https://mp.test/x' }));
    pagamentoMock.update.mockResolvedValue([1]);
    atualizarStatus.mockResolvedValue(pedidoVendas({ status: 'PAGO' }));
    gateway.consultarPagamento.mockResolvedValue(aprovado);
  });

  it('é público (não exige token)', async () => {
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
  });

  it('pagamento aprovado: consulta o gateway, confirma no Vendas e publica o evento uma vez', async () => {
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', action: 'payment.created', data: { id: '123' } });

    expect(r.status).toBe(200);
    expect(gateway.consultarPagamento).toHaveBeenCalledWith('123');
    expect(atualizarStatus).toHaveBeenCalledWith(77, 'PAGO');
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(JSON.parse(publicar.mock.calls[0][1]).dados).toMatchObject({ idPedido: 77, valor: 125, cliente: { email: 'rafael@mce.test' } });
  });

  it('aceita o id na query string (?data.id=) e id numérico', async () => {
    await api.post('/pagamentos/webhook?type=payment&data.id=456').send({});
    expect(gateway.consultarPagamento).toHaveBeenLastCalledWith('456');
    await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: 789 } });
    expect(gateway.consultarPagamento).toHaveBeenLastCalledWith('789');
  });

  it.each([
    ['outro tipo de notificação', { type: 'merchant_order', data: { id: '1' } }],
    ['sem id', { type: 'payment' }],
    ['corpo vazio', {}],
  ])('ignora %s sem consultar o gateway', async (_nome, corpoWebhook) => {
    const r = await api.post('/pagamentos/webhook').send(corpoWebhook);
    expect(r.status).toBe(200);
    expect(gateway.consultarPagamento).not.toHaveBeenCalled();
  });

  it('repetição do webhook não publica o evento de novo', async () => {
    pagamentoMock.update.mockResolvedValue([0]); // já estava APROVADO
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
    expect(atualizarStatus).toHaveBeenCalledTimes(1); // o Vendas aceita repetir PAGO
    expect(publicar).not.toHaveBeenCalled();
  });

  it('NÃO confirma quando o valor pago difere do registrado', async () => {
    gateway.consultarPagamento.mockResolvedValue({ ...aprovado, valor: 1 });
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
    expect(atualizarStatus).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });

  it('não repete o webhook (200) quando o Vendas não aceita mais o pagamento, ex.: pedido cancelado', async () => {
    atualizarStatus.mockRejectedValue(new ErroHttp(409, 'O pedido não pode mais receber este pagamento'));
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
    expect(publicar).not.toHaveBeenCalled();
  });

  it('responde 503 quando o Vendas está fora do ar, para o Mercado Pago tentar de novo', async () => {
    atualizarStatus.mockRejectedValue(new ErroHttp(503, 'Vendas indisponível no momento'));
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(503);
  });

  it('responde 503 quando o gateway não consegue ser consultado', async () => {
    gateway.consultarPagamento.mockRejectedValue(new ErroHttp(503, 'Mercado Pago indisponível no momento'));
    expect((await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } })).status).toBe(503);
  });

  it.each(['rejected', 'cancelled'])('marca como RECUSADO quando o pagamento é %s', async (status) => {
    const pendente = pagamentoCom();
    pagamentoMock.findOne.mockResolvedValue(pendente);
    gateway.consultarPagamento.mockResolvedValue({ ...aprovado, status });
    await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(pendente.update).toHaveBeenCalledWith({ status: 'RECUSADO' });
    expect(atualizarStatus).not.toHaveBeenCalled();
  });

  it('não rebaixa um pagamento já APROVADO por causa de uma recusa tardia', async () => {
    const pago = pagamentoCom({ status: 'APROVADO' });
    pagamentoMock.findOne.mockResolvedValue(pago);
    gateway.consultarPagamento.mockResolvedValue({ ...aprovado, status: 'rejected' });
    await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(pago.update).not.toHaveBeenCalled();
  });

  it('ignora pagamento em andamento (pending / in_process)', async () => {
    gateway.consultarPagamento.mockResolvedValue({ ...aprovado, status: 'in_process' });
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
    expect(atualizarStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['pagamento desconhecido no gateway', () => gateway.consultarPagamento.mockResolvedValue(null)],
    ['sem referência externa', () => gateway.consultarPagamento.mockResolvedValue({ ...aprovado, externalReference: null })],
    ['referência que não é um pedido', () => gateway.consultarPagamento.mockResolvedValue({ ...aprovado, externalReference: 'abc' })],
    ['pedido sem pagamento registrado', () => pagamentoMock.findOne.mockResolvedValue(null)],
  ])('responde 200 e ignora: %s', async (_nome, preparar) => {
    preparar();
    const r = await api.post('/pagamentos/webhook').send({ type: 'payment', data: { id: '123' } });
    expect(r.status).toBe(200);
    expect(atualizarStatus).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });
});

describe('POST /pagamentos/:idPedido/sincronizar (plano B do webhook)', () => {
  const aprovado = { status: 'approved', externalReference: '77', valor: 125 };
  const sincronizar = (headers = cliente, id: number | string = 77) =>
    api.post(`/pagamentos/${id}/sincronizar`).set(headers);

  beforeEach(() => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ url_pagamento: 'https://mp.test/x' }));
    pagamentoMock.update.mockResolvedValue([1]);
    atualizarStatus.mockResolvedValue(pedidoVendas({ status: 'PAGO' }));
    gateway.buscarPagamentosPorReferencia.mockResolvedValue([aprovado]);
  });

  it('exige token', async () => {
    expect((await api.post('/pagamentos/77/sincronizar')).status).toBe(401);
  });

  it('confirma o pagamento quando o Mercado Pago já registrou um pagamento aprovado', async () => {
    const r = await sincronizar();

    expect(r.status).toBe(200);
    expect(r.body.status).toBe('APROVADO');
    expect(gateway.buscarPagamentosPorReferencia).toHaveBeenCalledWith('77');
    expect(atualizarStatus).toHaveBeenCalledWith(77, 'PAGO');
    expect(publicar).toHaveBeenCalledTimes(1);
  });

  it('chamar de novo depois de aprovado não consulta o gateway nem repete o evento', async () => {
    pagamentoMock.findOne.mockResolvedValue(pagamentoCom({ status: 'APROVADO' }));
    const r = await sincronizar();
    expect(r.status).toBe(200);
    expect(gateway.buscarPagamentosPorReferencia).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });

  it('não confirma quando o valor pago difere do registrado', async () => {
    gateway.buscarPagamentosPorReferencia.mockResolvedValue([{ ...aprovado, valor: 1 }]);
    const r = await sincronizar();
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('PENDENTE');
    expect(atualizarStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['sem nenhum pagamento no gateway', []],
    ['pagamento em andamento', [{ ...aprovado, status: 'in_process' }]],
    ['uma recusa e um pagamento ainda pendente', [{ ...aprovado, status: 'rejected' }, { ...aprovado, status: 'pending' }]],
    ['pagamentos de outro pedido', [{ ...aprovado, externalReference: '999' }]],
  ])('mantém PENDENTE: %s', async (_nome, encontrados) => {
    gateway.buscarPagamentosPorReferencia.mockResolvedValue(encontrados);
    const pendente = pagamentoCom({ url_pagamento: 'https://mp.test/x' });
    pagamentoMock.findOne.mockResolvedValue(pendente);

    const r = await sincronizar();

    expect(r.body.status).toBe('PENDENTE');
    expect(pendente.update).not.toHaveBeenCalled();
    expect(atualizarStatus).not.toHaveBeenCalled();
  });

  it('marca RECUSADO quando todos os pagamentos feitos foram recusados ou cancelados', async () => {
    const pendente = pagamentoCom();
    pagamentoMock.findOne.mockResolvedValue(pendente);
    gateway.buscarPagamentosPorReferencia.mockResolvedValue([
      { ...aprovado, status: 'rejected' },
      { ...aprovado, status: 'cancelled' },
    ]);
    await sincronizar();
    expect(pendente.update).toHaveBeenCalledWith({ status: 'RECUSADO' });
  });

  it('um pagamento aprovado vence recusas anteriores', async () => {
    gateway.buscarPagamentosPorReferencia.mockResolvedValue([{ ...aprovado, status: 'rejected' }, aprovado]);
    const r = await sincronizar();
    expect(r.body.status).toBe('APROVADO');
  });

  it('só o dono (ou quem tem pedidos:listar-todos) sincroniza', async () => {
    expect((await sincronizar(outroCliente)).status).toBe(403);
    expect(gateway.buscarPagamentosPorReferencia).not.toHaveBeenCalled();
    expect((await sincronizar(admin)).status).toBe(200);
  });

  it('responde 404 sem pagamento e 400 com id inválido', async () => {
    pagamentoMock.findOne.mockResolvedValue(null);
    expect((await sincronizar()).status).toBe(404);
    expect((await sincronizar(cliente, 'abc')).status).toBe(400);
  });

  it('responde 503 se o Mercado Pago estiver fora do ar', async () => {
    gateway.buscarPagamentosPorReferencia.mockRejectedValue(new ErroHttp(503, 'Mercado Pago indisponível no momento'));
    expect((await sincronizar()).status).toBe(503);
  });
});

describe('saúde e métricas', () => {
  it('GET /health/live e /health respondem 200', async () => {
    expect((await api.get('/health/live')).status).toBe(200);
    const r = await api.get('/health');
    expect(r.status).toBe(200);
    expect(r.body.banco).toBe('ok');
  });

  it('GET /metrics exige o token de métricas', async () => {
    expect((await api.get('/metrics')).status).toBe(401);
    const r = await api.get('/metrics').set({ Authorization: 'Bearer token-de-teste' });
    expect(r.status).toBe(200);
    expect(r.text).toContain('pagamento_eventos_total');
  });

  it('rota inexistente responde 404', async () => {
    expect((await api.get('/nao-existe')).status).toBe(404);
  });
});
