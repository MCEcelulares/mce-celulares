import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Op, ForeignKeyConstraintError } from 'sequelize';
import { app } from '../src/app';
import { redis } from '../src/config/redis';
import { Produto, Categoria, Marca } from '../src/models';

const api = request(app);
const produtoMock = Produto as unknown as Record<string, jest.Mock>;
const categoriaMock = Categoria as unknown as Record<string, jest.Mock>;
const marcaMock = Marca as unknown as Record<string, jest.Mock>;

const token = (permissoes: string[]) =>
  jwt.sign(
    { id_usuario: 1, email: 'a@mce.test', admin: false, cargos: [], permissoes },
    process.env.TESTE_JWT_PRIVATE_KEY as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
const admin = { Authorization: `Bearer ${token(['catalogo:gerenciar'])}` };
const cliente = { Authorization: `Bearer ${token([])}` };
const servico = { Authorization: 'Bearer token-de-servico-teste' };

// Simula uma linha do MySQL: DECIMAL chega como texto.
const linha = (extra: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = {
    id_produto: 1,
    nome: 'iPhone 15',
    descricao: null,
    preco: '2599.90',
    estoque: 10,
    imagem: null,
    destaque: false,
    ativo: true,
    peso: '0.171',
    altura: null,
    largura: null,
    comprimento: null,
    id_marca: 1,
    id_categoria: 2,
    criado_em: '2026-10-01T00:00:00.000Z',
    marca: { id_marca: 1, nome: 'Apple' },
    categoria: { id_categoria: 2, nome: 'Smartphones' },
    ...extra,
  };
  return {
    ...dados,
    toJSON: () => ({ ...dados }),
    update: jest.fn(async (novo: Record<string, unknown>) => {
      Object.assign(dados, novo);
    }),
  };
};

const novoProduto = { nome: 'Galaxy S24', preco: 3999.9, id_marca: 1, id_categoria: 2 };

beforeEach(async () => {
  jest.clearAllMocks();
  await redis.flushall();
});

describe('GET /produtos', () => {
  it('usa os padrões: só ativos, mais recentes, página 1 com 20 itens', async () => {
    produtoMock.findAndCountAll.mockResolvedValue({ rows: [linha()], count: 1 });

    const r = await api.get('/produtos');

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pagina: 1, limite: 20, total: 1 });
    expect(r.body.dados[0]).toMatchObject({ id_produto: 1, preco: 2599.9, peso: 0.171, altura: null });
    const args = produtoMock.findAndCountAll.mock.calls[0][0];
    expect(args.where).toEqual({ ativo: true });
    expect(args).toMatchObject({ limit: 20, offset: 0 });
    expect(args.order[0]).toEqual(['criado_em', 'DESC']);
  });

  it('traduz os filtros para a consulta', async () => {
    produtoMock.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await api.get(
      '/produtos?categoria=2&marca=1&precoMin=100&precoMax=500&busca=50%25_&disponivel=true&ordenar=preco_asc&pagina=3&limite=10'
    );

    const args = produtoMock.findAndCountAll.mock.calls[0][0];
    expect(args.where).toEqual({
      ativo: true,
      id_categoria: 2,
      id_marca: 1,
      preco: { [Op.gte]: 100, [Op.lte]: 500 },
      nome: { [Op.like]: '%50\\%\\_%' },
      estoque: { [Op.gt]: 0 },
    });
    expect(args).toMatchObject({ limit: 10, offset: 20 });
    expect(args.order[0]).toEqual(['preco', 'ASC']);
  });

  it.each([
    ['precoMin maior que precoMax', '?precoMin=500&precoMax=100'],
    ['ordenar desconhecido', '?ordenar=barato'],
    ['limite acima do máximo', '?limite=1000'],
    ['página zero', '?pagina=0'],
    ['categoria não numérica', '?categoria=abc'],
  ])('rejeita %s com 400', async (_nome, query) => {
    const r = await api.get(`/produtos${query}`);
    expect(r.status).toBe(400);
    expect(produtoMock.findAndCountAll).not.toHaveBeenCalled();
  });
});

describe('GET /produtos/destaque e /produtos/recentes', () => {
  it('destaque filtra por destaque=true e limita em 10 por padrão', async () => {
    produtoMock.findAll.mockResolvedValue([linha({ destaque: true })]);
    const r = await api.get('/produtos/destaque');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(produtoMock.findAll.mock.calls[0][0]).toMatchObject({ where: { ativo: true, destaque: true }, limit: 10 });
  });

  it('recentes aceita ?limite= e ordena por criado_em', async () => {
    produtoMock.findAll.mockResolvedValue([]);
    await api.get('/produtos/recentes?limite=3');
    const args = produtoMock.findAll.mock.calls[0][0];
    expect(args).toMatchObject({ where: { ativo: true }, limit: 3 });
    expect(args.order[0]).toEqual(['criado_em', 'DESC']);
  });

  it('rejeita limite inválido com 400', async () => {
    expect((await api.get('/produtos/destaque?limite=0')).status).toBe(400);
    expect((await api.get('/produtos/recentes?limite=51')).status).toBe(400);
  });
});

describe('GET /produtos/:id (cache-aside)', () => {
  it('lê do banco na primeira vez e do cache na segunda', async () => {
    produtoMock.findOne.mockResolvedValue(linha());

    const primeira = await api.get('/produtos/1');
    const segunda = await api.get('/produtos/1');

    expect(primeira.status).toBe(200);
    expect(segunda.body).toEqual(primeira.body);
    expect(primeira.body.preco).toBe(2599.9);
    expect(produtoMock.findOne).toHaveBeenCalledTimes(1);
    expect(await redis.get('produto:1')).not.toBeNull();
  });

  it('responde 404 quando o produto não existe ou está inativo', async () => {
    produtoMock.findOne.mockResolvedValue(null);
    const r = await api.get('/produtos/99');
    expect(r.status).toBe(404);
    expect(produtoMock.findOne.mock.calls[0][0].where).toEqual({ id_produto: 99, ativo: true });
  });

  it('rejeita id inválido com 400', async () => {
    expect((await api.get('/produtos/abc')).status).toBe(400);
  });
});

describe('POST /produtos', () => {
  it('exige token', async () => {
    expect((await api.post('/produtos').send(novoProduto)).status).toBe(401);
  });

  it('exige a permissão catalogo:gerenciar', async () => {
    const r = await api.post('/produtos').set(cliente).send(novoProduto);
    expect(r.status).toBe(403);
    expect(produtoMock.create).not.toHaveBeenCalled();
  });

  it('cria o produto aplicando os padrões', async () => {
    produtoMock.create.mockResolvedValue({ id_produto: 7 });
    produtoMock.findByPk.mockResolvedValue(linha({ id_produto: 7, nome: 'Galaxy S24' }));

    const r = await api.post('/produtos').set(admin).send(novoProduto);

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id_produto: 7, nome: 'Galaxy S24' });
    expect(produtoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...novoProduto, estoque: 0, destaque: false, ativo: true })
    );
  });

  it.each([
    ['sem nome', { ...novoProduto, nome: '' }],
    ['preço negativo', { ...novoProduto, preco: -1 }],
    ['preço com 3 casas decimais', { ...novoProduto, preco: 10.999 }],
    ['estoque fracionado', { ...novoProduto, estoque: 1.5 }],
    ['sem marca', { nome: 'X', preco: 10, id_categoria: 2 }],
  ])('rejeita %s com 400', async (_nome, corpo) => {
    const r = await api.post('/produtos').set(admin).send(corpo);
    expect(r.status).toBe(400);
    expect(produtoMock.create).not.toHaveBeenCalled();
  });

  it('responde 400 quando marca ou categoria não existem', async () => {
    produtoMock.create.mockRejectedValue(new ForeignKeyConstraintError({}));
    const r = await api.post('/produtos').set(admin).send(novoProduto);
    expect(r.status).toBe(400);
    expect(r.body.erro).toMatch(/Marca ou categoria/);
  });
});

describe('PATCH /produtos/:id', () => {
  it('exige a permissão catalogo:gerenciar', async () => {
    expect((await api.patch('/produtos/1').send({ preco: 10 })).status).toBe(401);
    expect((await api.patch('/produtos/1').set(cliente).send({ preco: 10 })).status).toBe(403);
  });

  it('rejeita corpo vazio com 400', async () => {
    expect((await api.patch('/produtos/1').set(admin).send({})).status).toBe(400);
  });

  it('atualiza e invalida o cache', async () => {
    produtoMock.findOne.mockResolvedValue(linha());
    await api.get('/produtos/1');
    expect(await redis.get('produto:1')).not.toBeNull();

    const existente = linha();
    produtoMock.findByPk
      .mockResolvedValueOnce(existente)
      .mockResolvedValueOnce(linha({ preco: '2999.00' }));

    const r = await api.patch('/produtos/1').set(admin).send({ preco: 2999 });

    expect(r.status).toBe(200);
    expect(r.body.preco).toBe(2999);
    expect(existente.update).toHaveBeenCalledWith({ preco: 2999 });
    expect(await redis.get('produto:1')).toBeNull();
  });

  it('permite inativar um produto (ativo=false)', async () => {
    const existente = linha();
    produtoMock.findByPk
      .mockResolvedValueOnce(existente)
      .mockResolvedValueOnce(linha({ ativo: false }));
    const r = await api.patch('/produtos/1').set(admin).send({ ativo: false });
    expect(r.status).toBe(200);
    expect(existente.update).toHaveBeenCalledWith({ ativo: false });
  });

  it('responde 404 quando o produto não existe', async () => {
    produtoMock.findByPk.mockResolvedValue(null);
    expect((await api.patch('/produtos/99').set(admin).send({ preco: 10 })).status).toBe(404);
  });
});

describe('POST /produtos/:id/estoque/baixa (uso interno do Vendas)', () => {
  it('não aceita o JWT de usuário, só o token de serviço', async () => {
    expect((await api.post('/produtos/1/estoque/baixa').send({ quantidade: 1 })).status).toBe(401);
    expect((await api.post('/produtos/1/estoque/baixa').set(admin).send({ quantidade: 1 })).status).toBe(401);
    expect(produtoMock.update).not.toHaveBeenCalled();
  });

  it('rejeita quantidade inválida com 400', async () => {
    for (const quantidade of [0, -1, 1.5, 'dois']) {
      const r = await api.post('/produtos/1/estoque/baixa').set(servico).send({ quantidade });
      expect(r.status).toBe(400);
    }
  });

  it('baixa o estoque, invalida o cache e devolve o saldo', async () => {
    produtoMock.findOne.mockResolvedValue(linha());
    await api.get('/produtos/1');
    produtoMock.update.mockResolvedValue([1]);
    produtoMock.findByPk.mockResolvedValue(linha({ estoque: 7 }));

    const r = await api.post('/produtos/1/estoque/baixa').set(servico).send({ quantidade: 3 });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id_produto: 1, estoque: 7 });
    const where = produtoMock.update.mock.calls[0][1].where;
    expect(where).toEqual({ id_produto: 1, ativo: true, estoque: { [Op.gte]: 3 } });
    expect(await redis.get('produto:1')).toBeNull();
  });

  it('responde 409 quando não há estoque suficiente', async () => {
    produtoMock.update.mockResolvedValue([0]);
    produtoMock.findByPk.mockResolvedValue(linha({ estoque: 1 }));
    const r = await api.post('/produtos/1/estoque/baixa').set(servico).send({ quantidade: 5 });
    expect(r.status).toBe(409);
  });

  it('responde 404 quando o produto não existe ou está inativo', async () => {
    produtoMock.update.mockResolvedValue([0]);
    produtoMock.findByPk.mockResolvedValue(null);
    expect((await api.post('/produtos/9/estoque/baixa').set(servico).send({ quantidade: 1 })).status).toBe(404);

    produtoMock.findByPk.mockResolvedValue(linha({ ativo: false }));
    expect((await api.post('/produtos/1/estoque/baixa').set(servico).send({ quantidade: 1 })).status).toBe(404);
  });

  it('fica desligada (404) quando SERVICE_TOKEN não está configurado', async () => {
    const original = process.env.SERVICE_TOKEN;
    delete process.env.SERVICE_TOKEN;
    try {
      const r = await api.post('/produtos/1/estoque/baixa').set(servico).send({ quantidade: 1 });
      expect(r.status).toBe(404);
    } finally {
      process.env.SERVICE_TOKEN = original;
    }
  });
});

describe('POST /produtos/:id/estoque/reposicao (uso interno do Vendas)', () => {
  it('só aceita o token de serviço', async () => {
    expect((await api.post('/produtos/1/estoque/reposicao').send({ quantidade: 1 })).status).toBe(401);
    expect((await api.post('/produtos/1/estoque/reposicao').set(admin).send({ quantidade: 1 })).status).toBe(401);
    expect(produtoMock.update).not.toHaveBeenCalled();
  });

  it('rejeita quantidade inválida com 400', async () => {
    const r = await api.post('/produtos/1/estoque/reposicao').set(servico).send({ quantidade: 0 });
    expect(r.status).toBe(400);
  });

  it('soma ao estoque (inclusive de produto inativo), invalida o cache e devolve o saldo', async () => {
    produtoMock.findOne.mockResolvedValue(linha());
    await api.get('/produtos/1');
    produtoMock.update.mockResolvedValue([1]);
    produtoMock.findByPk.mockResolvedValue(linha({ estoque: 13, ativo: false }));

    const r = await api.post('/produtos/1/estoque/reposicao').set(servico).send({ quantidade: 3 });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id_produto: 1, estoque: 13 });
    expect(produtoMock.update.mock.calls[0][1].where).toEqual({ id_produto: 1 });
    expect(await redis.get('produto:1')).toBeNull();
  });

  it('responde 404 quando o produto não existe', async () => {
    produtoMock.update.mockResolvedValue([0]);
    expect((await api.post('/produtos/9/estoque/reposicao').set(servico).send({ quantidade: 1 })).status).toBe(404);
  });
});

describe.each([
  ['categorias', categoriaMock, { nome: 'Smartphones', icone: 'phone' }],
  ['marcas', marcaMock, { nome: 'Apple' }],
])('/%s', (rota, modelo, corpo) => {
  it('lista só as ativas, em ordem alfabética (público)', async () => {
    modelo.findAll.mockResolvedValue([{ id: 1, nome: 'A' }]);
    const r = await api.get(`/${rota}`);
    expect(r.status).toBe(200);
    expect(modelo.findAll.mock.calls[0][0]).toMatchObject({ where: { ativo: true }, order: [['nome', 'ASC']] });
  });

  it('criar exige token e permissão', async () => {
    expect((await api.post(`/${rota}`).send(corpo)).status).toBe(401);
    expect((await api.post(`/${rota}`).set(cliente).send(corpo)).status).toBe(403);
  });

  it('cria com ativo=true por padrão', async () => {
    modelo.create.mockResolvedValue({ id: 5, ...corpo });
    const r = await api.post(`/${rota}`).set(admin).send(corpo);
    expect(r.status).toBe(201);
    expect(modelo.create).toHaveBeenCalledWith({ ...corpo, ativo: true });
  });

  it('rejeita nome vazio com 400', async () => {
    expect((await api.post(`/${rota}`).set(admin).send({ nome: ' ' })).status).toBe(400);
  });

  it('atualiza (inclusive inativando) e responde 404 se não existir', async () => {
    const existente = { update: jest.fn().mockResolvedValue({ id: 1, ativo: false }) };
    modelo.findByPk.mockResolvedValueOnce(existente);
    const r = await api.patch(`/${rota}/1`).set(admin).send({ ativo: false });
    expect(r.status).toBe(200);
    expect(existente.update).toHaveBeenCalledWith({ ativo: false });

    modelo.findByPk.mockResolvedValueOnce(null);
    expect((await api.patch(`/${rota}/9`).set(admin).send({ nome: 'X' })).status).toBe(404);
  });
});

describe('cache indisponível', () => {
  it('continua respondendo pelo banco quando o Redis falha', async () => {
    produtoMock.findOne.mockResolvedValue(linha());
    const get = jest.spyOn(redis, 'get').mockRejectedValue(new Error('redis fora do ar'));
    const set = jest.spyOn(redis, 'set').mockRejectedValue(new Error('redis fora do ar'));
    try {
      const r = await api.get('/produtos/1');
      expect(r.status).toBe(200);
      expect(r.body.nome).toBe('iPhone 15');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
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
    expect(r.text).toContain('catalogo_eventos_total');
  });

  it('rota inexistente responde 404', async () => {
    expect((await api.get('/nao-existe')).status).toBe(404);
  });
});
