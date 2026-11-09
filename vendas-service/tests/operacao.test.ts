import request from 'supertest';
import { Op } from 'sequelize';
import { app } from '../src/app';
import { Pedido, ItemPedido } from '../src/models';
import * as catalogo from '../src/clients/catalogoClient';
import { sequelize } from '../src/config/database';
import { expirarPedidosVencidos, recuperarPedidosOrfaos } from '../src/jobs/expirarPedidos';
import { ErroHttp } from '../src/middlewares/errorHandler';
import { tokenDe, bearer, servico, pedidoCom } from './helpers';

const api = request(app);
const pedidoMock = Pedido as unknown as Record<string, jest.Mock>;
const itemPedidoMock = ItemPedido as unknown as Record<string, jest.Mock>;
const devolverReserva = catalogo.devolverReserva as jest.Mock;

const cliente = bearer(tokenDe(5));
const gestor = bearer(tokenDe(1, ['dashboard:ver']));

beforeEach(() => {
  jest.resetAllMocks();
  devolverReserva.mockResolvedValue(undefined);
});

describe('expira_em', () => {
  it('pedido aguardando pagamento mostra quando expira (data + PEDIDO_EXPIRA_MINUTOS)', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom({ data: '2026-10-28T12:00:00.000Z' }));
    const r = await api.get('/pedidos/77').set(cliente);
    expect(r.body.expira_em).toBe('2026-10-28T12:30:00.000Z');
  });

  it('pedido que não aguarda mais pagamento não expira', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom({ status: 'PAGO' }));
    expect((await api.get('/pedidos/77').set(cliente)).body.expira_em).toBeNull();
  });

  it('PEDIDO_EXPIRA_MINUTOS=0 desliga a expiração', async () => {
    process.env.PEDIDO_EXPIRA_MINUTOS = '0';
    try {
      pedidoMock.findByPk.mockResolvedValue(pedidoCom());
      expect((await api.get('/pedidos/77').set(cliente)).body.expira_em).toBeNull();
    } finally {
      process.env.PEDIDO_EXPIRA_MINUTOS = '30';
    }
  });
});

describe('corrida na troca de status', () => {
  it('responde 409 e NÃO devolve a reserva quando outra chamada mudou o pedido antes', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom({ status: 'PAGO' }));
    pedidoMock.update.mockResolvedValue([0]);

    const r = await api.patch('/pedidos/77/status').set(servico).send({ status: 'CANCELADO' });

    expect(r.status).toBe(409);
    expect(devolverReserva).not.toHaveBeenCalled();
  });
});

describe('expiração de pedidos não pagos', () => {
  const agora = new Date('2026-10-28T13:00:00.000Z');

  it('busca só pedidos aguardando pagamento anteriores ao limite e os cancela devolvendo a reserva do pedido', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }]);
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
    pedidoMock.update.mockResolvedValue([1]);

    const expirados = await expirarPedidosVencidos(agora);

    expect(expirados).toBe(1);
    const consulta = pedidoMock.findAll.mock.calls[0][0];
    expect(consulta.where).toEqual({
      status: 'AGUARDANDO_PAGAMENTO',
      ativo: true,
      data: { [Op.lt]: new Date('2026-10-28T12:30:00.000Z') },
    });
    expect(pedidoMock.update).toHaveBeenCalledWith(
      { status: 'CANCELADO' },
      { where: { id_pedido: 77, status: 'AGUARDANDO_PAGAMENTO' } }
    );
    expect(devolverReserva.mock.calls).toEqual([[77]]);
  });

  it('não cancela nem devolve a reserva se o pedido foi pago no meio da rotina', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }, { id_pedido: 78 }]);
    pedidoMock.findByPk
      .mockResolvedValueOnce(pedidoCom({ status: 'PAGO' })) // já pago quando foi relido
      .mockResolvedValueOnce(pedidoCom({ id_pedido: 78 })); // pago entre a leitura e a troca
    pedidoMock.update.mockResolvedValue([0]);

    expect(await expirarPedidosVencidos(agora)).toBe(0);
    expect(devolverReserva).not.toHaveBeenCalled();
  });

  it('uma falha em um pedido não impede os outros', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }, { id_pedido: 78 }]);
    pedidoMock.findByPk
      .mockRejectedValueOnce(new Error('banco caiu'))
      .mockResolvedValueOnce(pedidoCom({ id_pedido: 78 }));
    pedidoMock.update.mockResolvedValue([1]);

    expect(await expirarPedidosVencidos(agora)).toBe(1);
  });

  it('com a devolução da reserva falhando o pedido continua cancelado (fica em métrica/log)', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }]);
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
    pedidoMock.update.mockResolvedValue([1]);
    devolverReserva.mockRejectedValue(new ErroHttp(502, 'falha'));

    expect(await expirarPedidosVencidos(agora)).toBe(1);
    expect(devolverReserva).toHaveBeenCalledTimes(1);
  });

  it('PEDIDO_EXPIRA_MINUTOS=0 não consulta nada', async () => {
    process.env.PEDIDO_EXPIRA_MINUTOS = '0';
    try {
      expect(await expirarPedidosVencidos(agora)).toBe(0);
      expect(pedidoMock.findAll).not.toHaveBeenCalled();
    } finally {
      process.env.PEDIDO_EXPIRA_MINUTOS = '30';
    }
  });
});

describe('recuperação de pedidos órfãos', () => {
  const agora = new Date('2026-10-28T13:00:00.000Z');
  const orfao = (id = 77) => pedidoCom({ id_pedido: id, ativo: false });

  beforeEach(() => {
    (sequelize as unknown as Record<string, jest.Mock>).transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb({ id: 'tx' }));
  });

  it('busca só pedidos invisíveis e aguardando pagamento anteriores ao prazo (padrão 10 min)', async () => {
    pedidoMock.findAll.mockResolvedValue([]);

    expect(await recuperarPedidosOrfaos(agora)).toBe(0);

    const consulta = pedidoMock.findAll.mock.calls[0][0];
    expect(consulta.where).toEqual({
      status: 'AGUARDANDO_PAGAMENTO',
      ativo: false,
      data: { [Op.lt]: new Date('2026-10-28T12:50:00.000Z') },
    });
    expect(consulta.limit).toBe(50);
  });

  it('o prazo é configurável com PEDIDO_ORFAO_MINUTOS', async () => {
    process.env.PEDIDO_ORFAO_MINUTOS = '3';
    try {
      pedidoMock.findAll.mockResolvedValue([]);
      await recuperarPedidosOrfaos(agora);
      expect(pedidoMock.findAll.mock.calls[0][0].where.data).toEqual({ [Op.lt]: new Date('2026-10-28T12:57:00.000Z') });
    } finally {
      delete process.env.PEDIDO_ORFAO_MINUTOS;
    }
  });

  it('devolve a reserva e só então apaga o pedido invisível', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }]);
    pedidoMock.findByPk.mockResolvedValue(orfao());

    expect(await recuperarPedidosOrfaos(agora)).toBe(1);

    expect(devolverReserva).toHaveBeenCalledWith(77);
    expect(pedidoMock.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { id_pedido: 77, ativo: false } }));
    expect(devolverReserva.mock.invocationCallOrder[0]).toBeLessThan(pedidoMock.destroy.mock.invocationCallOrder[0]);
  });

  it('se a devolução falhar, NÃO apaga o pedido (tenta de novo na próxima rodada) e segue com os outros', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }, { id_pedido: 78 }]);
    pedidoMock.findByPk.mockResolvedValueOnce(orfao(77)).mockResolvedValueOnce(orfao(78));
    devolverReserva.mockRejectedValueOnce(new ErroHttp(503, 'Catálogo indisponível')).mockResolvedValueOnce(undefined);

    expect(await recuperarPedidosOrfaos(agora)).toBe(1);

    expect(pedidoMock.destroy).toHaveBeenCalledTimes(1);
    expect(pedidoMock.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { id_pedido: 78, ativo: false } }));
  });

  it('não mexe em pedido que ficou visível ou sumiu entre a consulta e a recuperação', async () => {
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }, { id_pedido: 78 }]);
    pedidoMock.findByPk.mockResolvedValueOnce(pedidoCom({ ativo: true })).mockResolvedValueOnce(null);

    expect(await recuperarPedidosOrfaos(agora)).toBe(0);
    expect(devolverReserva).not.toHaveBeenCalled();
    expect(pedidoMock.destroy).not.toHaveBeenCalled();
  });

  it('roda mesmo com a expiração desligada (PEDIDO_EXPIRA_MINUTOS=0)', async () => {
    process.env.PEDIDO_EXPIRA_MINUTOS = '0';
    try {
      pedidoMock.findAll.mockResolvedValue([{ id_pedido: 77 }]);
      pedidoMock.findByPk.mockResolvedValue(orfao());
      expect(await recuperarPedidosOrfaos(agora)).toBe(1);
    } finally {
      process.env.PEDIDO_EXPIRA_MINUTOS = '30';
    }
  });
});

describe('painel administrativo (RF18, RF46, RF47)', () => {
  it.each(['/pedidos/resumo', '/pedidos/mais-vendidos'])('%s exige token e a permissão dashboard:ver', async (rota) => {
    expect((await api.get(rota)).status).toBe(401);
    expect((await api.get(rota).set(cliente)).status).toBe(403);
  });

  it('resumo: pedidos por status, receita total e receita por dia', async () => {
    pedidoMock.findAll
      .mockResolvedValueOnce([
        { status: 'PAGO', total: '3' },
        { status: 'CANCELADO', total: '1' },
        { status: 'AGUARDANDO_PAGAMENTO', total: '2' },
      ])
      .mockResolvedValueOnce([
        { dia: new Date('2026-10-27T00:00:00.000Z'), receita: '300.50', pedidos: '2' },
        { dia: '2026-10-28', receita: '99.90', pedidos: '1' },
      ]);
    pedidoMock.sum.mockResolvedValue('400.40');
    pedidoMock.count.mockResolvedValue(4);

    const r = await api.get('/pedidos/resumo?dias=7').set(gestor);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      total_pedidos: 6,
      pedidos_por_status: { AGUARDANDO_PAGAMENTO: 2, PAGO: 3, ENVIADO: 0, ENTREGUE: 0, CANCELADO: 1 },
      pedidos_ultimas_24h: 4,
      receita_total: 400.4,
      receita_por_dia: [
        { dia: '2026-10-27', receita: 300.5, pedidos: 2 },
        { dia: '2026-10-28', receita: 99.9, pedidos: 1 },
      ],
    });
    // a receita só conta pedidos pagos, enviados ou entregues
    const filtroReceita = pedidoMock.sum.mock.calls[0][1].where;
    expect(filtroReceita.status[Op.in]).toEqual(['PAGO', 'ENVIADO', 'ENTREGUE']);
  });

  it('resumo sem pedidos devolve zeros (e receita 0 quando a soma é nula)', async () => {
    pedidoMock.findAll.mockResolvedValue([]);
    pedidoMock.sum.mockResolvedValue(null);
    pedidoMock.count.mockResolvedValue(0);
    const r = await api.get('/pedidos/resumo').set(gestor);
    expect(r.body).toMatchObject({ total_pedidos: 0, receita_total: 0, receita_por_dia: [] });
  });

  it('mais vendidos: converte os números e respeita o limite', async () => {
    itemPedidoMock.findAll.mockResolvedValue([
      { id_produto: 10, nome_produto: 'iPhone 15', quantidade: '7', receita: '875.00' },
      { id_produto: 11, nome_produto: 'Capa', quantidade: '3', receita: '300.00' },
    ]);

    const r = await api.get('/pedidos/mais-vendidos?limite=5').set(gestor);

    expect(r.body).toEqual([
      { id_produto: 10, nome_produto: 'iPhone 15', quantidade_vendida: 7, receita: 875 },
      { id_produto: 11, nome_produto: 'Capa', quantidade_vendida: 3, receita: 300 },
    ]);
    expect(itemPedidoMock.findAll.mock.calls[0][0]).toMatchObject({ limit: 5 });
  });

  it.each(['/pedidos/resumo?dias=0', '/pedidos/resumo?dias=400', '/pedidos/mais-vendidos?limite=0', '/pedidos/mais-vendidos?limite=51'])(
    'rejeita %s com 400',
    async (rota) => {
      expect((await api.get(rota).set(gestor)).status).toBe(400);
    }
  );

  it('"resumo" não é confundido com um id de pedido', async () => {
    pedidoMock.findAll.mockResolvedValue([]);
    pedidoMock.sum.mockResolvedValue(0);
    pedidoMock.count.mockResolvedValue(0);
    expect((await api.get('/pedidos/resumo').set(gestor)).status).toBe(200);
    expect(pedidoMock.findByPk).not.toHaveBeenCalled();
  });
});
