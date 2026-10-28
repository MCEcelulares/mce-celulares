import request from 'supertest';
import { app } from '../src/app';
import { Carrinho, ItemCarrinho } from '../src/models';
import * as catalogo from '../src/clients/catalogoClient';
import { ErroHttp } from '../src/middlewares/errorHandler';
import { tokenDe, bearer, itemCarrinho, carrinhoCom, produtoCatalogo } from './helpers';

const api = request(app);
const carrinhoMock = Carrinho as unknown as Record<string, jest.Mock>;
const itemMock = ItemCarrinho as unknown as Record<string, jest.Mock>;
const buscarProduto = catalogo.buscarProduto as jest.Mock;

const usuario = bearer(tokenDe(5));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('autenticação', () => {
  it.each([
    ['GET', '/carrinho'],
    ['POST', '/carrinho/itens'],
    ['PATCH', '/carrinho/itens/1'],
    ['DELETE', '/carrinho/itens/1'],
  ])('%s %s exige token', async (metodo, rota) => {
    const r = await (api as never as Record<string, (u: string) => request.Test>)[metodo.toLowerCase()](rota);
    expect(r.status).toBe(401);
  });
});

describe('GET /carrinho', () => {
  it('cria o carrinho do usuário quando ainda não existe', async () => {
    carrinhoMock.findOne.mockResolvedValue(null);
    carrinhoMock.create.mockResolvedValue({ id_carrinho: 1 });

    const r = await api.get('/carrinho').set(usuario);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id_carrinho: 1, itens: [], total: 0 });
    expect(carrinhoMock.create).toHaveBeenCalledWith({ id_usuario: 5 });
    expect(carrinhoMock.findOne.mock.calls[0][0].where).toEqual({ id_usuario: 5, ativo: true });
  });

  it('calcula subtotais e total em centavos (sem erro de ponto flutuante)', async () => {
    carrinhoMock.findOne.mockResolvedValue(
      carrinhoCom([itemCarrinho(1, 10, 2, '10.50'), itemCarrinho(2, 11, 3, '0.10')])
    );

    const r = await api.get('/carrinho').set(usuario);

    expect(r.body.itens[0]).toMatchObject({ id_item_carrinho: 1, preco_unitario: 10.5, subtotal: 21 });
    expect(r.body.itens[1]).toMatchObject({ preco_unitario: 0.1, subtotal: 0.3 });
    expect(r.body.total).toBe(21.3);
  });
});

describe('POST /carrinho/itens', () => {
  it('adiciona um produto novo usando o preço atual do Catálogo', async () => {
    buscarProduto.mockResolvedValue(produtoCatalogo({ preco: 99.9, estoque: 5 }));
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([]));

    const r = await api.post('/carrinho/itens').set(usuario).send({ idProduto: 10, quantidade: 2 });

    expect(r.status).toBe(201);
    expect(buscarProduto).toHaveBeenCalledWith(10);
    expect(itemMock.create).toHaveBeenCalledWith({ id_carrinho: 1, id_produto: 10, preco_unitario: 99.9, quantidade: 2 });
  });

  it('soma a quantidade quando o produto já está no carrinho', async () => {
    const existente = itemCarrinho(1, 10, 2);
    buscarProduto.mockResolvedValue(produtoCatalogo({ preco: 120, estoque: 10 }));
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([existente]));

    const r = await api.post('/carrinho/itens').set(usuario).send({ idProduto: 10, quantidade: 3 });

    expect(r.status).toBe(201);
    expect(existente.update).toHaveBeenCalledWith({ quantidade: 5, preco_unitario: 120 });
    expect(itemMock.create).not.toHaveBeenCalled();
  });

  it('responde 404 quando o produto não existe no Catálogo', async () => {
    buscarProduto.mockResolvedValue(null);
    const r = await api.post('/carrinho/itens').set(usuario).send({ idProduto: 999, quantidade: 1 });
    expect(r.status).toBe(404);
    expect(itemMock.create).not.toHaveBeenCalled();
  });

  it('responde 409 quando a soma passa do estoque (RF26)', async () => {
    buscarProduto.mockResolvedValue(produtoCatalogo({ estoque: 4 }));
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([itemCarrinho(1, 10, 2)]));

    const r = await api.post('/carrinho/itens').set(usuario).send({ idProduto: 10, quantidade: 3 });

    expect(r.status).toBe(409);
    expect(r.body.erro).toMatch(/disponível: 4/);
  });

  it('responde 503 quando o Catálogo está fora do ar', async () => {
    buscarProduto.mockRejectedValue(new ErroHttp(503, 'Catálogo indisponível no momento'));
    const r = await api.post('/carrinho/itens').set(usuario).send({ idProduto: 10, quantidade: 1 });
    expect(r.status).toBe(503);
  });

  it.each([
    ['quantidade zero', { idProduto: 10, quantidade: 0 }],
    ['quantidade acima de 99', { idProduto: 10, quantidade: 100 }],
    ['quantidade fracionada', { idProduto: 10, quantidade: 1.5 }],
    ['idProduto em texto', { idProduto: 'abc', quantidade: 1 }],
    ['corpo vazio', {}],
  ])('rejeita %s com 400', async (_nome, corpo) => {
    const r = await api.post('/carrinho/itens').set(usuario).send(corpo);
    expect(r.status).toBe(400);
    expect(buscarProduto).not.toHaveBeenCalled();
  });
});

describe('PATCH /carrinho/itens/:id', () => {
  it('atualiza a quantidade e o preço', async () => {
    const item = itemCarrinho(1, 10, 2);
    buscarProduto.mockResolvedValue(produtoCatalogo({ preco: 130, estoque: 9 }));
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([item]));

    const r = await api.patch('/carrinho/itens/1').set(usuario).send({ quantidade: 7 });

    expect(r.status).toBe(200);
    expect(item.update).toHaveBeenCalledWith({ quantidade: 7, preco_unitario: 130 });
  });

  it('responde 404 para item que não está no carrinho do usuário', async () => {
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([itemCarrinho(1, 10, 2)]));
    const r = await api.patch('/carrinho/itens/99').set(usuario).send({ quantidade: 1 });
    expect(r.status).toBe(404);
  });

  it('responde 409 sem estoque ou com produto indisponível', async () => {
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([itemCarrinho(1, 10, 2)]));

    buscarProduto.mockResolvedValue(produtoCatalogo({ estoque: 3 }));
    expect((await api.patch('/carrinho/itens/1').set(usuario).send({ quantidade: 4 })).status).toBe(409);

    buscarProduto.mockResolvedValue(null);
    expect((await api.patch('/carrinho/itens/1').set(usuario).send({ quantidade: 1 })).status).toBe(409);
  });

  it('rejeita id e quantidade inválidos com 400', async () => {
    expect((await api.patch('/carrinho/itens/abc').set(usuario).send({ quantidade: 1 })).status).toBe(400);
    expect((await api.patch('/carrinho/itens/1').set(usuario).send({ quantidade: 0 })).status).toBe(400);
  });
});

describe('DELETE /carrinho/itens/:id', () => {
  it('remove o item', async () => {
    const item = itemCarrinho(1, 10, 2);
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([item]));
    const r = await api.delete('/carrinho/itens/1').set(usuario);
    expect(r.status).toBe(204);
    expect(item.destroy).toHaveBeenCalled();
  });

  it('responde 404 para item de outro carrinho', async () => {
    carrinhoMock.findOne.mockResolvedValue(carrinhoCom([]));
    expect((await api.delete('/carrinho/itens/1').set(usuario)).status).toBe(404);
  });
});
