import { Op, UniqueConstraintError } from 'sequelize';
import { Carrinho, EnderecoPedido, ItemCarrinho, ItemPedido, Pedido, UsuarioPedido } from '../src/models';
import * as carrinhoRepository from '../src/repositories/carrinhoRepository';
import * as pedidoRepository from '../src/repositories/pedidoRepository';
import { comTransacao } from '../src/repositories/transacao';
import { RegistroDuplicadoError } from '../src/repositories/erros';
import { sequelize } from '../src/config/database';

const carrinhoMock = Carrinho as unknown as Record<string, jest.Mock>;
const itemCarrinhoMock = ItemCarrinho as unknown as Record<string, jest.Mock>;
const pedidoMock = Pedido as unknown as Record<string, jest.Mock>;
const itemPedidoMock = ItemPedido as unknown as Record<string, jest.Mock>;
const enderecoMock = EnderecoPedido as unknown as Record<string, jest.Mock>;
const clienteMock = UsuarioPedido as unknown as Record<string, jest.Mock>;
const transaction = sequelize.transaction as unknown as jest.Mock;

const tx = { id: 'tx' } as never;

beforeEach(() => jest.resetAllMocks());

describe('transacao', () => {
  it('abre a transação do Sequelize e entrega ao trabalho', async () => {
    transaction.mockImplementation(async (trabalho: (t: unknown) => unknown) => trabalho({ id: 'tx' }));
    const r = await comTransacao(async (t) => ({ recebida: t }));
    expect(r).toEqual({ recebida: { id: 'tx' } });
  });
});

describe('carrinhoRepository', () => {
  it('busca o carrinho ativo do usuário com os itens em ordem', async () => {
    carrinhoMock.findOne.mockResolvedValue({ id_carrinho: 1 });
    expect(await carrinhoRepository.buscarAtivoComItens(5)).toEqual({ id_carrinho: 1 });
    const consulta = carrinhoMock.findOne.mock.calls[0][0];
    expect(consulta.where).toEqual({ id_usuario: 5, ativo: true });
    expect(consulta.include).toEqual([{ model: ItemCarrinho, as: 'itens' }]);
    expect(consulta.order).toEqual([[{ model: ItemCarrinho, as: 'itens' }, 'id_item_carrinho', 'ASC']]);
  });

  it('cria o carrinho do usuário', async () => {
    carrinhoMock.create.mockResolvedValue({ id_carrinho: 2 });
    await carrinhoRepository.criar(5);
    expect(carrinhoMock.create).toHaveBeenCalledWith({ id_usuario: 5 });
  });

  it('traduz violação de unicidade ao criar e ao atualizar item em RegistroDuplicadoError', async () => {
    itemCarrinhoMock.create.mockRejectedValue(new UniqueConstraintError({}));
    await expect(
      carrinhoRepository.criarItem({ id_carrinho: 1, id_produto: 10, preco_unitario: 9, quantidade: 1 })
    ).rejects.toBeInstanceOf(RegistroDuplicadoError);

    const item = { update: jest.fn().mockRejectedValue(new UniqueConstraintError({})) } as unknown as ItemCarrinho;
    await expect(carrinhoRepository.atualizarItem(item, { quantidade: 2, preco_unitario: 9 })).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
  });

  it('não esconde outros erros do banco', async () => {
    const falha = new Error('banco fora do ar');
    itemCarrinhoMock.create.mockRejectedValue(falha);
    await expect(
      carrinhoRepository.criarItem({ id_carrinho: 1, id_produto: 10, preco_unitario: 9, quantidade: 1 })
    ).rejects.toBe(falha);
  });

  it('remove o item e encerra o carrinho dentro da transação recebida', async () => {
    const item = { destroy: jest.fn().mockResolvedValue(undefined) } as unknown as ItemCarrinho;
    await carrinhoRepository.removerItem(item);
    expect(item.destroy).toHaveBeenCalled();

    const carrinho = { update: jest.fn().mockResolvedValue(undefined) } as unknown as Carrinho;
    await carrinhoRepository.encerrar(carrinho, tx);
    expect(carrinho.update).toHaveBeenCalledWith({ ativo: false }, { transaction: tx });
  });
});

describe('pedidoRepository', () => {
  const novoPedido = {
    valor_total: 200,
    valor_frete: 0,
    itens: [{ id_produto: 10, nome_produto: 'x'.repeat(200), quantidade: 2, preco_unitario: 100 }],
    endereco: {
      endereco: 'Rua A',
      numero: '10',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Campo Mourão',
      estado: 'PR',
      cep: '87300000',
    },
    cliente: { id_usuario: 5, nome: 'Ana', email: 'ana@mce.test', cpf: '52998224725', telefone: '44999999999' },
  };

  it('grava o pedido invisível com itens, endereço e cliente, tudo na mesma transação, e devolve o id', async () => {
    pedidoMock.create.mockResolvedValue({ id_pedido: 77 });

    expect(await pedidoRepository.gravarInvisivel(novoPedido, tx)).toBe(77);

    expect(pedidoMock.create).toHaveBeenCalledWith(
      { valor_total: 200, valor_frete: 0, status: 'AGUARDANDO_PAGAMENTO', ativo: false },
      { transaction: tx }
    );
    const itens = itemPedidoMock.bulkCreate.mock.calls[0][0];
    expect(itens).toEqual([
      { id_pedido: 77, id_produto: 10, nome_produto: 'x'.repeat(150), quantidade: 2, preco_unitario: 100 },
    ]);
    expect(itemPedidoMock.bulkCreate.mock.calls[0][1]).toEqual({ transaction: tx });
    expect(enderecoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_pedido: 77, cidade: 'Campo Mourão', cep: '87300000' }),
      { transaction: tx }
    );
    expect(clienteMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_pedido: 77, id_usuario: 5, cpf: '52998224725' }),
      { transaction: tx }
    );
  });

  it('torna o pedido visível pela transação recebida', async () => {
    await pedidoRepository.tornarVisivel(77, tx);
    expect(pedidoMock.update).toHaveBeenCalledWith({ ativo: true }, { where: { id_pedido: 77 }, transaction: tx });
  });

  it('descarta itens, endereço, cliente e o pedido, e só apaga o pedido se ele ainda estiver invisível', async () => {
    await pedidoRepository.descartarInvisivel(77, tx);
    expect(itemPedidoMock.destroy).toHaveBeenCalledWith({ where: { id_pedido: 77 }, transaction: tx });
    expect(enderecoMock.destroy).toHaveBeenCalledWith({ where: { id_pedido: 77 }, transaction: tx });
    expect(clienteMock.destroy).toHaveBeenCalledWith({ where: { id_pedido: 77 }, transaction: tx });
    expect(pedidoMock.destroy).toHaveBeenCalledWith({ where: { id_pedido: 77, ativo: false }, transaction: tx });
  });

  it('busca o detalhe com itens (em ordem), endereço e cliente', async () => {
    pedidoMock.findByPk.mockResolvedValue({ id_pedido: 77 });
    await pedidoRepository.buscarDetalhe(77);
    const [id, consulta] = pedidoMock.findByPk.mock.calls[0];
    expect(id).toBe(77);
    expect(consulta.include).toHaveLength(3);
    expect(consulta.order).toEqual([[{ model: ItemPedido, as: 'itens' }, 'id_item', 'ASC']]);

    await pedidoRepository.buscarPorId(78);
    expect(pedidoMock.findByPk).toHaveBeenLastCalledWith(78);
  });

  it('lista só pedidos visíveis; com idUsuario filtra pelo cliente, sem idUsuario traz todos', async () => {
    pedidoMock.findAndCountAll.mockResolvedValue({ rows: ['a'], count: 25 });

    const r = await pedidoRepository.listar({ idUsuario: 5, status: 'PAGO', limite: 10, pagina: 3 });
    expect(r).toEqual({ registros: ['a'], total: 25 });
    const consulta = pedidoMock.findAndCountAll.mock.calls[0][0];
    expect(consulta.where).toEqual({ ativo: true, status: 'PAGO' });
    expect(consulta.include[0]).toMatchObject({ as: 'cliente', where: { id_usuario: 5 }, required: true });
    expect(consulta.limit).toBe(10);
    expect(consulta.offset).toBe(20);
    expect(consulta.order).toEqual([['data', 'DESC'], ['id_pedido', 'DESC']]);

    await pedidoRepository.listar({ limite: 10, pagina: 1 });
    const todos = pedidoMock.findAndCountAll.mock.calls[1][0];
    expect(todos.where).toEqual({ ativo: true });
    expect(todos.include[0].where).toBeUndefined();
    expect(todos.include[0].required).toBeUndefined();
  });

  it('trocarStatus é condicional ao status lido e diz se algum pedido mudou', async () => {
    pedidoMock.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([0]);
    expect(await pedidoRepository.trocarStatus(77, 'AGUARDANDO_PAGAMENTO', 'PAGO')).toBe(true);
    expect(pedidoMock.update).toHaveBeenCalledWith(
      { status: 'PAGO' },
      { where: { id_pedido: 77, status: 'AGUARDANDO_PAGAMENTO' } }
    );
    expect(await pedidoRepository.trocarStatus(77, 'AGUARDANDO_PAGAMENTO', 'PAGO')).toBe(false);
  });

  it('lista os ids vencidos (visíveis) e os invisíveis antigos, do mais antigo ao mais novo', async () => {
    const limite = new Date('2026-11-01T10:00:00Z');
    pedidoMock.findAll.mockResolvedValue([{ id_pedido: 1 }, { id_pedido: 2 }]);

    expect(await pedidoRepository.buscarIdsVencidos(limite, 50)).toEqual([1, 2]);
    expect(pedidoMock.findAll).toHaveBeenLastCalledWith({
      where: { status: 'AGUARDANDO_PAGAMENTO', ativo: true, data: { [Op.lt]: limite } },
      attributes: ['id_pedido'],
      order: [['data', 'ASC']],
      limit: 50,
    });

    expect(await pedidoRepository.buscarIdsInvisiveisAntigos(limite, 20)).toEqual([1, 2]);
    expect(pedidoMock.findAll).toHaveBeenLastCalledWith({
      where: { status: 'AGUARDANDO_PAGAMENTO', ativo: false, data: { [Op.lt]: limite } },
      attributes: ['id_pedido'],
      order: [['data', 'ASC']],
      limit: 20,
    });
  });
});
