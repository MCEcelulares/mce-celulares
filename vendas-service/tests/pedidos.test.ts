import request from 'supertest';
import { app } from '../src/app';
import { sequelize } from '../src/config/database';
import { redis } from '../src/config/redis';
import { Carrinho, Pedido, ItemPedido, EnderecoPedido, UsuarioPedido } from '../src/models';
import * as catalogo from '../src/clients/catalogoClient';
import * as identidade from '../src/clients/identidadeClient';
import { ErroHttp } from '../src/middlewares/errorHandler';
import { tokenDe, bearer, servico, itemCarrinho, carrinhoCom, produtoCatalogo, pedidoCom } from './helpers';

const api = request(app);
const carrinhoMock = Carrinho as unknown as Record<string, jest.Mock>;
const pedidoMock = Pedido as unknown as Record<string, jest.Mock>;
const itemPedidoMock = ItemPedido as unknown as Record<string, jest.Mock>;
const enderecoMock = EnderecoPedido as unknown as Record<string, jest.Mock>;
const usuarioPedidoMock = UsuarioPedido as unknown as Record<string, jest.Mock>;
const transaction = (sequelize as unknown as Record<string, jest.Mock>).transaction;
const buscarProduto = catalogo.buscarProduto as jest.Mock;
const baixarEstoque = catalogo.baixarEstoque as jest.Mock;
const reporEstoque = catalogo.reporEstoque as jest.Mock;
const buscarUsuario = identidade.buscarUsuario as jest.Mock;
const buscarEndereco = identidade.buscarEndereco as jest.Mock;

const tokenCliente = tokenDe(5);
const cliente = bearer(tokenCliente);
const outroCliente = bearer(tokenDe(6));

const perfil = { id_usuario: 5, nome: 'Rafael', email: 'rafael@mce.test', cpf: '52998224725', telefone: '45999990000', ativo: true };
const endereco = {
  id_endereco: 3, endereco: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Cascavel', estado: 'PR', cep: '85800000',
};

let publicar: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  transaction.mockImplementation(async (callback: (t: unknown) => unknown) => callback({ id: 'tx' }));
  publicar = jest.spyOn(redis, 'publish');
});

afterEach(() => publicar.mockRestore());

describe('POST /pedidos', () => {
  // Carrinho com 2 unidades do produto 10 e 1 do produto 11; o Catálogo tem preços diferentes dos do carrinho.
  let carrinho: ReturnType<typeof carrinhoCom>;

  beforeEach(() => {
    carrinho = carrinhoCom([itemCarrinho(1, 10, 2, '9.99'), itemCarrinho(2, 11, 1, '9.99')]);
    carrinhoMock.findOne.mockResolvedValue(carrinho);
    buscarUsuario.mockResolvedValue(perfil);
    buscarEndereco.mockResolvedValue(endereco);
    buscarProduto.mockImplementation(async (id: number) =>
      id === 10
        ? produtoCatalogo({ id_produto: 10, nome: 'iPhone 15', preco: 12.5, estoque: 5 })
        : produtoCatalogo({ id_produto: 11, nome: 'Capa', preco: 100, estoque: 5 })
    );
    baixarEstoque.mockResolvedValue('ok');
    reporEstoque.mockResolvedValue(undefined);
    pedidoMock.create.mockResolvedValue({ id_pedido: 77 });
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
  });

  it('cria o pedido: valida usuário e endereço, baixa o estoque, grava os snapshots e publica o evento', async () => {
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id_pedido: 77, status: 'AGUARDANDO_PAGAMENTO', valor_total: 125 });

    // o token do usuário é repassado ao Identidade
    expect(buscarUsuario).toHaveBeenCalledWith(5, `Bearer ${tokenCliente}`);
    expect(buscarEndereco).toHaveBeenCalledWith(5, 3, `Bearer ${tokenCliente}`);

    // estoque reservado no Catálogo
    expect(baixarEstoque.mock.calls).toEqual([[10, 2], [11, 1]]);

    // total usa o preço ATUAL do Catálogo (2 x 12,50 + 1 x 100,00), não o do carrinho
    expect(pedidoMock.create.mock.calls[0][0]).toMatchObject({ valor_total: 125, valor_frete: 0, status: 'AGUARDANDO_PAGAMENTO' });
    expect(itemPedidoMock.bulkCreate.mock.calls[0][0]).toEqual([
      { id_pedido: 77, id_produto: 10, nome_produto: 'iPhone 15', quantidade: 2, preco_unitario: 12.5 },
      { id_pedido: 77, id_produto: 11, nome_produto: 'Capa', quantidade: 1, preco_unitario: 100 },
    ]);
    expect(enderecoMock.create.mock.calls[0][0]).toMatchObject({ id_pedido: 77, cidade: 'Cascavel', cep: '85800000' });
    expect(usuarioPedidoMock.create.mock.calls[0][0]).toMatchObject({
      id_pedido: 77, id_usuario: 5, nome: 'Rafael', email: 'rafael@mce.test', cpf: '52998224725',
    });

    // carrinho encerrado dentro da mesma transação
    expect(carrinho.update).toHaveBeenCalledWith({ ativo: false }, { transaction: { id: 'tx' } });
    expect(reporEstoque).not.toHaveBeenCalled();
  });

  it('publica pedido.criado no formato do ADR-008', async () => {
    await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });

    expect(publicar).toHaveBeenCalledTimes(1);
    const [canal, mensagem] = publicar.mock.calls[0];
    const evento = JSON.parse(mensagem);
    expect(canal).toBe('pedido.criado');
    expect(evento).toMatchObject({
      tipo: 'pedido.criado',
      versao: 1,
      origem: 'vendas-service',
      dados: {
        idPedido: 77,
        status: 'AGUARDANDO_PAGAMENTO',
        valorTotal: 125,
        cliente: { nome: 'Rafael', email: 'rafael@mce.test' },
      },
    });
    expect(evento.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(evento.ocorridoEm).toString()).not.toBe('Invalid Date');
    expect(JSON.stringify(evento)).not.toMatch(/52998224725|45999990000/); // sem CPF nem telefone
  });

  it('não devolve CPF nem id_envio_externo na resposta', async () => {
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(JSON.stringify(r.body)).not.toMatch(/52998224725|EXT-1|cpf/);
    expect(r.body.cliente).toEqual({ id_usuario: 5, nome: 'Rafael', email: 'rafael@mce.test', telefone: '45999990000' });
  });

  it('continua criando o pedido se a publicação do evento falhar', async () => {
    publicar.mockRejectedValueOnce(new Error('redis fora do ar'));
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(201);
  });

  it.each([
    ['sem carrinho', () => carrinhoMock.findOne.mockResolvedValue(null)],
    ['com carrinho vazio', () => carrinhoMock.findOne.mockResolvedValue(carrinhoCom([]))],
  ])('responde 422 %s (RF27)', async (_nome, preparar) => {
    preparar();
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(422);
    expect(baixarEstoque).not.toHaveBeenCalled();
  });

  it.each([
    ['usuário não encontrado no Identidade', () => buscarUsuario.mockResolvedValue(null), /Usuário inválido/],
    ['usuário inativo', () => buscarUsuario.mockResolvedValue({ ...perfil, ativo: false }), /Usuário inválido/],
    ['usuário sem CPF', () => buscarUsuario.mockResolvedValue({ ...perfil, cpf: null }), /CPF e telefone/],
    ['usuário sem telefone', () => buscarUsuario.mockResolvedValue({ ...perfil, telefone: null }), /CPF e telefone/],
    ['endereço que não é do usuário', () => buscarEndereco.mockResolvedValue(null), /Endereço inválido/],
    ['produto que saiu do catálogo', () => buscarProduto.mockResolvedValueOnce(null), /não está mais disponível/],
  ])('responde 422 com %s', async (_nome, preparar, mensagem) => {
    preparar();
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(422);
    expect(r.body.erro).toMatch(mensagem);
    expect(baixarEstoque).not.toHaveBeenCalled();
    expect(pedidoMock.create).not.toHaveBeenCalled();
  });

  it('responde 409 sem reservar nada quando o estoque atual não cobre o carrinho', async () => {
    buscarProduto.mockImplementation(async (id: number) => produtoCatalogo({ id_produto: id, nome: `P${id}`, estoque: id === 11 ? 0 : 5 }));
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(409);
    expect(baixarEstoque).not.toHaveBeenCalled();
  });

  it('devolve o que já reservou se a baixa de um item falhar (corrida de estoque)', async () => {
    baixarEstoque.mockResolvedValueOnce('ok').mockResolvedValueOnce('insuficiente');

    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });

    expect(r.status).toBe(409);
    expect(reporEstoque.mock.calls).toEqual([[10, 2]]);
    expect(pedidoMock.create).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });

  it('devolve todo o estoque reservado se gravar no banco falhar', async () => {
    transaction.mockRejectedValue(new Error('banco fora do ar'));

    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });

    expect(r.status).toBe(500);
    expect(reporEstoque.mock.calls).toEqual([[10, 2], [11, 1]]);
    expect(publicar).not.toHaveBeenCalled();
  });

  it('responde 503 e devolve o estoque se o Catálogo cair no meio da reserva', async () => {
    baixarEstoque.mockResolvedValueOnce('ok').mockRejectedValueOnce(new ErroHttp(503, 'Catálogo indisponível no momento'));
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(503);
    expect(reporEstoque.mock.calls).toEqual([[10, 2]]);
  });

  it('responde 503 se o Identidade estiver fora do ar', async () => {
    buscarUsuario.mockRejectedValue(new ErroHttp(503, 'Identidade indisponível no momento'));
    const r = await api.post('/pedidos').set(cliente).send({ idEndereco: 3 });
    expect(r.status).toBe(503);
    expect(baixarEstoque).not.toHaveBeenCalled();
  });

  it('exige token e idEndereco válido', async () => {
    expect((await api.post('/pedidos').send({ idEndereco: 3 })).status).toBe(401);
    expect((await api.post('/pedidos').set(cliente).send({})).status).toBe(400);
    expect((await api.post('/pedidos').set(cliente).send({ idEndereco: 'x' })).status).toBe(400);
  });
});

describe('GET /pedidos', () => {
  beforeEach(() => {
    pedidoMock.findAndCountAll.mockResolvedValue({ rows: [pedidoCom()], count: 1 });
  });

  it('lista só os pedidos do usuário logado, sem itens, do mais recente para o mais antigo', async () => {
    const r = await api.get('/pedidos').set(cliente);

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pagina: 1, limite: 20, total: 1 });
    expect(r.body.dados[0]).toMatchObject({ id_pedido: 77, status: 'AGUARDANDO_PAGAMENTO', valor_total: 125 });
    expect(r.body.dados[0].itens).toBeUndefined();

    const args = pedidoMock.findAndCountAll.mock.calls[0][0];
    expect(args.where).toEqual({ ativo: true });
    expect(args.include[0]).toMatchObject({ as: 'cliente', required: true, where: { id_usuario: 5 } });
    expect(args.order[0]).toEqual(['data', 'DESC']);
  });

  it('filtra por status e pagina (RF37)', async () => {
    await api.get('/pedidos?status=PAGO&pagina=3&limite=10').set(cliente);
    const args = pedidoMock.findAndCountAll.mock.calls[0][0];
    expect(args.where).toEqual({ ativo: true, status: 'PAGO' });
    expect(args).toMatchObject({ limit: 10, offset: 20 });
  });

  it('todos=true exige a permissão pedidos:listar-todos (RF32)', async () => {
    expect((await api.get('/pedidos?todos=true').set(cliente)).status).toBe(403);
    expect(pedidoMock.findAndCountAll).not.toHaveBeenCalled();

    const admin = bearer(tokenDe(1, ['pedidos:listar-todos']));
    const r = await api.get('/pedidos?todos=true').set(admin);
    expect(r.status).toBe(200);
    expect(pedidoMock.findAndCountAll.mock.calls[0][0].include[0].where).toBeUndefined();
  });

  it.each([['status=XPTO'], ['pagina=0'], ['limite=500']])('rejeita ?%s com 400', async (query) => {
    expect((await api.get(`/pedidos?${query}`).set(cliente)).status).toBe(400);
  });

  it('exige token', async () => {
    expect((await api.get('/pedidos')).status).toBe(401);
  });
});

describe('GET /pedidos/:id', () => {
  it('mostra o detalhe ao dono, com itens e endereço', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
    const r = await api.get('/pedidos/77').set(cliente);
    expect(r.status).toBe(200);
    expect(r.body.itens).toHaveLength(2);
    expect(r.body.endereco).toMatchObject({ cidade: 'Cascavel' });
    expect(r.body.itens[0].preco_unitario).toBe(12.5);
  });

  it('nega a outro cliente (403) e libera a quem tem pedidos:listar-todos (RF34)', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
    expect((await api.get('/pedidos/77').set(outroCliente)).status).toBe(403);

    const admin = bearer(tokenDe(1, ['pedidos:listar-todos']));
    expect((await api.get('/pedidos/77').set(admin)).status).toBe(200);
  });

  it('responde 404 para pedido inexistente e 400 para id inválido', async () => {
    pedidoMock.findByPk.mockResolvedValue(null);
    expect((await api.get('/pedidos/999').set(cliente)).status).toBe(404);
    expect((await api.get('/pedidos/abc').set(cliente)).status).toBe(400);
  });
});

describe('PATCH /pedidos/:id/status', () => {
  const patch = (status: string, headers: Record<string, string> = servico, id = 77) =>
    api.patch(`/pedidos/${id}/status`).set(headers).send({ status });

  beforeEach(() => {
    reporEstoque.mockResolvedValue(undefined);
  });

  it('exige credencial válida (token de serviço ou JWT)', async () => {
    expect((await api.patch('/pedidos/77/status').send({ status: 'PAGO' })).status).toBe(401);
    expect((await patch('PAGO', { Authorization: 'Bearer token-errado' })).status).toBe(401);
  });

  it('o Pagamento (token de serviço) confirma o pagamento e recebe os dados do cliente para o evento', async () => {
    const pedido = pedidoCom();
    pedidoMock.findByPk.mockResolvedValue(pedido);

    const r = await patch('PAGO');

    expect(r.status).toBe(200);
    expect(r.body.status).toBe('PAGO');
    expect(pedido.update).toHaveBeenCalledWith({ status: 'PAGO' });
    expect(r.body.cliente).toMatchObject({ nome: 'Rafael', email: 'rafael@mce.test' });
    expect(r.body.valor_total).toBe(125);
    expect(reporEstoque).not.toHaveBeenCalled();
  });

  it('repetir o status atual é aceito sem alterar nada (idempotente)', async () => {
    const pedido = pedidoCom({ status: 'PAGO' });
    pedidoMock.findByPk.mockResolvedValue(pedido);
    const r = await patch('PAGO');
    expect(r.status).toBe(200);
    expect(pedido.update).not.toHaveBeenCalled();
  });

  it.each([
    ['ENTREGUE', 'PAGO'],
    ['CANCELADO', 'PAGO'],
    ['AGUARDANDO_PAGAMENTO', 'ENVIADO'],
    ['ENVIADO', 'AGUARDANDO_PAGAMENTO'],
    ['ENVIADO', 'CANCELADO'],
  ])('recusa a transição de %s para %s com 409', async (atual, novo) => {
    const pedido = pedidoCom({ status: atual });
    pedidoMock.findByPk.mockResolvedValue(pedido);
    const r = await patch(novo);
    expect(r.status).toBe(409);
    expect(pedido.update).not.toHaveBeenCalled();
  });

  it('com JWT, exige pedidos:atualizar-status para avançar o pedido', async () => {
    pedidoMock.findByPk.mockImplementation(async () => pedidoCom({ status: 'PAGO' }));

    expect((await patch('ENVIADO', bearer(tokenDe(1, [])))).status).toBe(403);
    expect((await patch('ENVIADO', bearer(tokenDe(1, ['pedidos:cancelar'])))).status).toBe(403);
    expect((await patch('ENVIADO', bearer(tokenDe(1, ['pedidos:atualizar-status'])))).status).toBe(200);
  });

  it('com JWT, cancelar exige pedidos:cancelar e devolve o estoque de cada item (RF35)', async () => {
    const pedido = pedidoCom({ status: 'PAGO' });
    pedidoMock.findByPk.mockResolvedValue(pedido);

    expect((await patch('CANCELADO', bearer(tokenDe(1, ['pedidos:atualizar-status'])))).status).toBe(403);
    expect(reporEstoque).not.toHaveBeenCalled();

    const r = await patch('CANCELADO', bearer(tokenDe(1, ['pedidos:cancelar'])));
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('CANCELADO');
    expect(reporEstoque.mock.calls).toEqual([[10, 2], [11, 1]]);
  });

  it('cancela mesmo que a devolução de estoque falhe (fica registrado para conciliação)', async () => {
    pedidoMock.findByPk.mockResolvedValue(pedidoCom());
    reporEstoque.mockRejectedValue(new ErroHttp(502, 'falha'));
    const r = await patch('CANCELADO');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('CANCELADO');
    expect(reporEstoque).toHaveBeenCalledTimes(2); // tentou todos os itens
  });

  it('responde 404 para pedido inexistente e 400 para status inválido', async () => {
    pedidoMock.findByPk.mockResolvedValue(null);
    expect((await patch('PAGO')).status).toBe(404);
    expect((await patch('INVENTADO')).status).toBe(400);
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
    expect(r.text).toContain('vendas_eventos_total');
  });

  it('rota inexistente responde 404', async () => {
    expect((await api.get('/nao-existe')).status).toBe(404);
  });
});
