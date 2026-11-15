import { Op } from 'sequelize';
import { ItemPedido, Pedido } from '../src/models';
import { maisVendidos, resumoDoPainel } from '../src/services/painelService';

const pedidoMock = Pedido as unknown as Record<string, jest.Mock>;
const itemPedidoMock = ItemPedido as unknown as Record<string, jest.Mock>;

const STATUS_COM_RECEITA = ['PAGO', 'ENVIADO', 'ENTREGUE'];

beforeEach(() => jest.resetAllMocks());

describe('resumoDoPainel', () => {
  beforeEach(() => {
    pedidoMock.findAll
      .mockResolvedValueOnce([
        { status: 'PAGO', total: '3' },
        { status: 'CANCELADO', total: '1' },
      ])
      .mockResolvedValueOnce([
        { dia: new Date('2026-11-10T00:00:00.000Z'), receita: '250.50', pedidos: '2' },
        { dia: '2026-11-11', receita: '100.00', pedidos: '1' },
      ]);
    pedidoMock.sum.mockResolvedValue('350.5');
    pedidoMock.count.mockResolvedValue(4);
  });

  it('monta o resumo: todos os status (inclusive os zerados), receita e pedidos das últimas 24h', async () => {
    const r = await resumoDoPainel(7);

    expect(r).toEqual({
      total_pedidos: 4,
      pedidos_por_status: { AGUARDANDO_PAGAMENTO: 0, PAGO: 3, ENVIADO: 0, ENTREGUE: 0, CANCELADO: 1 },
      pedidos_ultimas_24h: 4,
      receita_total: 350.5,
      receita_por_dia: [
        { dia: '2026-11-10', receita: 250.5, pedidos: 2 },
        { dia: '2026-11-11', receita: 100, pedidos: 1 },
      ],
    });
  });

  it('só conta pedidos visíveis, e só pedidos pagos, enviados ou entregues entram na receita', async () => {
    await resumoDoPainel(7);

    const porStatus = pedidoMock.findAll.mock.calls[0][0];
    expect(porStatus.where).toEqual({ ativo: true });
    expect(porStatus.group).toEqual(['status']);

    const porDia = pedidoMock.findAll.mock.calls[1][0];
    expect(porDia.where.ativo).toBe(true);
    expect(porDia.where.status).toEqual({ [Op.in]: STATUS_COM_RECEITA });
    expect(porDia.where.data[Op.gte]).toBeInstanceOf(Date);

    expect(pedidoMock.sum).toHaveBeenCalledWith('valor_total', {
      where: { ativo: true, status: { [Op.in]: STATUS_COM_RECEITA } },
    });
    expect(pedidoMock.count.mock.calls[0][0].where.ativo).toBe(true);
  });

  it('a janela da receita por dia acompanha o parâmetro dias', async () => {
    const antes = Date.now();
    await resumoDoPainel(7);
    const desde: Date = pedidoMock.findAll.mock.calls[1][0].where.data[Op.gte];
    const esperado = antes - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(desde.getTime() - esperado)).toBeLessThan(5000);
  });

  it('sem nenhuma venda a receita total é 0', async () => {
    pedidoMock.sum.mockResolvedValue(null);
    expect((await resumoDoPainel(7)).receita_total).toBe(0);
  });
});

describe('maisVendidos', () => {
  it('devolve os produtos com quantidade e receita como número', async () => {
    itemPedidoMock.findAll.mockResolvedValue([
      { id_produto: 10, nome_produto: 'iPhone 15', quantidade: '8', receita: '8000.00' },
      { id_produto: null, nome_produto: 'Produto removido', quantidade: '2', receita: '40.50' },
    ]);

    expect(await maisVendidos(5)).toEqual([
      { id_produto: 10, nome_produto: 'iPhone 15', quantidade_vendida: 8, receita: 8000 },
      { id_produto: null, nome_produto: 'Produto removido', quantidade_vendida: 2, receita: 40.5 },
    ]);
  });

  it('respeita o limite e conta só pedidos visíveis que geraram receita', async () => {
    itemPedidoMock.findAll.mockResolvedValue([]);
    await maisVendidos(3);

    const consulta = itemPedidoMock.findAll.mock.calls[0][0];
    expect(consulta.limit).toBe(3);
    expect(consulta.group).toEqual(['id_produto']);
    expect(consulta.include[0].required).toBe(true);
    expect(consulta.include[0].where).toEqual({ ativo: true, status: { [Op.in]: STATUS_COM_RECEITA } });
  });
});
