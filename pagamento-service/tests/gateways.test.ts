jest.unmock('../src/gateways');
jest.unmock('../src/clients/vendasClient');

import { obterGateway } from '../src/gateways';
import { criarGatewayMercadoPago } from '../src/gateways/mercadoPago';
import * as vendas from '../src/clients/vendasClient';
import { ErroHttp } from '../src/middlewares/errorHandler';

const resposta = (status: number, corpo?: unknown) =>
  ({
    status,
    json: async () => {
      if (corpo === undefined) throw new Error('sem corpo');
      return corpo;
    },
  }) as Response;

const rejeitaCom = async (promessa: Promise<unknown>, status: number) => {
  const erro = await promessa.then(
    () => null,
    (e) => e
  );
  expect(erro).toBeInstanceOf(ErroHttp);
  expect((erro as ErroHttp).status).toBe(status);
};

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchMock.mockRestore();
  delete process.env.GATEWAY_PAGAMENTO;
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.FRONTEND_URL;
  process.env.VENDAS_SERVICE_TOKEN = 'token-do-vendas-teste';
});

describe('obterGateway', () => {
  it('o padrão é o Mercado Pago', () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-teste';
    expect(obterGateway().nome).toBe('mercadopago');
  });

  it('sem token do Mercado Pago NÃO cai para o simulado: responde 503', async () => {
    let erro: unknown;
    try {
      obterGateway();
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroHttp);
    expect((erro as ErroHttp).status).toBe(503);
  });

  it('o simulado só vale quando pedido explicitamente e aprova na hora', async () => {
    process.env.GATEWAY_PAGAMENTO = 'simulado';
    const gateway = obterGateway();
    expect(gateway.nome).toBe('simulado');
    expect(await gateway.iniciar({} as never)).toEqual({ idExterno: null, urlPagamento: null, aprovadoNaHora: true });
    expect(await gateway.consultarPagamento('1')).toBeNull();
  });

  it('valor desconhecido em GATEWAY_PAGAMENTO responde 503', () => {
    process.env.GATEWAY_PAGAMENTO = 'paypal';
    expect(() => obterGateway()).toThrow(ErroHttp);
  });
});

describe('Mercado Pago — iniciar (preferência)', () => {
  const dados = {
    idPedido: 77,
    valor: 125,
    emailCliente: 'rafael@mce.test',
    valorFrete: 0,
    expiraEm: null as string | null,
    itens: [
      { id: '10', titulo: 'iPhone 15', quantidade: 2, precoUnitario: 12.5 },
      { id: '11', titulo: 'Capa', quantidade: 1, precoUnitario: 100 },
    ],
  };
  const gateway = criarGatewayMercadoPago('APP_USR-token');

  it('cria a preferência com itens, e-mail e referência do pedido', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', init_point: 'https://mp.test/pref-1' }));

    const cobranca = await gateway.iniciar(dados);

    expect(cobranca).toEqual({ idExterno: 'pref-1', urlPagamento: 'https://mp.test/pref-1', aprovadoNaHora: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer APP_USR-token');
    const corpo = JSON.parse(init.body);
    expect(corpo.items).toEqual([
      { id: '10', title: 'iPhone 15', quantity: 2, currency_id: 'BRL', unit_price: 12.5 },
      { id: '11', title: 'Capa', quantity: 1, currency_id: 'BRL', unit_price: 100 },
    ]);
    expect(corpo.payer).toEqual({ email: 'rafael@mce.test' });
    expect(corpo.external_reference).toBe('77');
    expect(corpo.notification_url).toBeUndefined();
    expect(corpo.back_urls).toBeUndefined();
  });

  it('inclui a URL do webhook e as de retorno quando configuradas', async () => {
    process.env.PUBLIC_BASE_URL = 'https://loja.com/pagamento/';
    process.env.FRONTEND_URL = 'https://loja.com';
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', init_point: 'https://mp.test/pref-1' }));

    await gateway.iniciar(dados);

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.notification_url).toBe('https://loja.com/pagamento/pagamentos/webhook');
    expect(corpo.back_urls).toEqual({
      success: 'https://loja.com/pedidos/77',
      pending: 'https://loja.com/pedidos/77',
      failure: 'https://loja.com/pedidos/77',
    });
    expect(corpo.auto_return).toBe('approved');
  });

  it('limita o link ao prazo do pedido (expires + datas com deslocamento +00:00)', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', init_point: 'x' }));

    await gateway.iniciar({ ...dados, expiraEm: '2026-10-28T12:30:00.000Z' });

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.expires).toBe(true);
    expect(corpo.expiration_date_to).toBe('2026-10-28T12:30:00.000+00:00');
    expect(corpo.expiration_date_from).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+\+00:00$/);
  });

  it('sem prazo no pedido, a preferência não expira', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', init_point: 'x' }));
    await gateway.iniciar(dados);
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.expires).toBeUndefined();
    expect(corpo.expiration_date_to).toBeUndefined();
  });

  it('cobra o frete como um item quando houver', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', init_point: 'x' }));
    await gateway.iniciar({ ...dados, valor: 140, valorFrete: 15 });
    const itens = JSON.parse(fetchMock.mock.calls[0][1].body).items;
    expect(itens[itens.length - 1]).toEqual({ id: 'frete', title: 'Frete', quantity: 1, currency_id: 'BRL', unit_price: 15 });
  });

  it('usa o link de sandbox quando o de produção não vem', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id: 'pref-1', sandbox_init_point: 'https://sandbox.mp.test/pref-1' }));
    expect((await gateway.iniciar(dados)).urlPagamento).toBe('https://sandbox.mp.test/pref-1');
  });

  it('vira 502 quando o Mercado Pago recusa e 503 quando está fora do ar (sem repetir a criação)', async () => {
    fetchMock.mockResolvedValue(resposta(400, { message: 'invalid' }));
    await rejeitaCom(gateway.iniciar(dados), 502);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(resposta(500));
    await rejeitaCom(gateway.iniciar(dados), 503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Mercado Pago — consultarPagamento', () => {
  const gateway = criarGatewayMercadoPago('APP_USR-token');

  it('lê status, referência externa e valor', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id: 999, status: 'approved', external_reference: '77', transaction_amount: 125 }));

    expect(await gateway.consultarPagamento('999')).toEqual({ id: '999', status: 'approved', externalReference: '77', valor: 125 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/999');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer APP_USR-token');
  });

  it('protege o id na URL, devolve null para 404 e tenta de novo uma vez', async () => {
    fetchMock.mockResolvedValue(resposta(404, {}));
    expect(await gateway.consultarPagamento('1/../x')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/1%2F..%2Fx');

    fetchMock.mockClear();
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(
      resposta(200, { id: 5, status: 'pending', transaction_amount: 10 })
    );
    expect(await gateway.consultarPagamento('5')).toEqual({ id: '5', status: 'pending', externalReference: null, valor: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Mercado Pago — buscarPagamentosPorReferencia', () => {
  const gateway = criarGatewayMercadoPago('APP_USR-token');

  it('busca por external_reference, do mais novo para o mais antigo, e converte os campos', async () => {
    fetchMock.mockResolvedValue(
      resposta(200, {
        results: [
          { id: 11, status: 'approved', external_reference: '77', transaction_amount: 125 },
          { id: 10, status: 'rejected', external_reference: '77', transaction_amount: 125 },
        ],
      })
    );

    expect(await gateway.buscarPagamentosPorReferencia('77')).toEqual([
      { id: '11', status: 'approved', externalReference: '77', valor: 125 },
      { id: '10', status: 'rejected', externalReference: '77', valor: 125 },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/payments/search?external_reference=77&sort=date_created&criteria=desc');
    expect(init.headers.Authorization).toBe('Bearer APP_USR-token');
  });

  it('protege a referência na URL, devolve lista vazia sem resultados e falha com 502 em erro', async () => {
    fetchMock.mockResolvedValue(resposta(200, {}));
    expect(await gateway.buscarPagamentosPorReferencia('a&b')).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toContain('external_reference=a%26b');

    fetchMock.mockResolvedValue(resposta(401, { message: 'invalid token' }));
    await rejeitaCom(gateway.buscarPagamentosPorReferencia('77'), 502);
  });
});

describe('Vendas (cliente)', () => {
  it('busca o pedido com o token de serviço', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_pedido: 77, status: 'AGUARDANDO_PAGAMENTO' }));
    expect(await vendas.buscarPedido(77)).toMatchObject({ id_pedido: 77 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://vendas.test:3003/pedidos/77');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-do-vendas-teste');
  });

  it('devolve null no 404 e 502 numa resposta inesperada', async () => {
    fetchMock.mockResolvedValue(resposta(404, { erro: 'x' }));
    expect(await vendas.buscarPedido(77)).toBeNull();
    fetchMock.mockResolvedValue(resposta(401, { erro: 'x' }));
    await rejeitaCom(vendas.buscarPedido(77), 502);
  });

  it('confirma o pagamento com PATCH de status e traduz os erros', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_pedido: 77, status: 'PAGO', cliente: { nome: 'R', email: 'r@x' } }));
    expect((await vendas.atualizarStatus(77, 'PAGO')).status).toBe('PAGO');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://vendas.test:3003/pedidos/77/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'PAGO' });

    fetchMock.mockResolvedValue(resposta(404, {}));
    await rejeitaCom(vendas.atualizarStatus(77, 'PAGO'), 404);
    fetchMock.mockResolvedValue(resposta(409, {}));
    await rejeitaCom(vendas.atualizarStatus(77, 'PAGO'), 409);
    fetchMock.mockResolvedValue(resposta(403, {}));
    await rejeitaCom(vendas.atualizarStatus(77, 'PAGO'), 502);
  });

  it('sem VENDAS_SERVICE_TOKEN responde 503 sem chamar o Vendas', async () => {
    delete process.env.VENDAS_SERVICE_TOKEN;
    await rejeitaCom(vendas.buscarPedido(77), 503);
    await rejeitaCom(vendas.atualizarStatus(77, 'PAGO'), 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
