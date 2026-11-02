import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { app } from '../src/app';
import { sequelize } from '../src/config/database';
import { redis } from '../src/config/redis';
import { Categoria, Marca, Produto, ReservaEstoque } from '../src/models';
import { auth, gerarToken, gerarTokenExpirado, pngMinimo } from './helpers';

const api = request(app);
const run = Date.now().toString(36);
const tag = (nome: string) => `teste-${run}-${nome}`;
const tokenGestor = gerarToken(['catalogo:gerenciar', 'painel:acessar'], 10);
const tokenCliente = gerarToken([], 20);
const servico = { 'x-service-token': process.env.SERVICE_TOKEN as string };
let proximoPedido = Number(String(Date.now()).slice(-8)) * 10;
const novoPedido = () => ++proximoPedido;

let idCategoria = 0;
let idMarca = 0;
let idCategoria2 = 0;
let idMarca2 = 0;

const criarProduto = async (nome: string, extra: Record<string, unknown> = {}) => {
  const r = await api
    .post('/produtos')
    .set(auth(tokenGestor))
    .send({ nome: tag(nome), preco: 1000, estoque: 10, id_marca: idMarca, id_categoria: idCategoria, ...extra });
  expect(r.status).toBe(201);
  return r.body as { id_produto: number; estoque: number; preco: number };
};

const estoqueDe = async (id: number) => (await Produto.findByPk(id))!.estoque;

beforeAll(async () => {
  const cat = await api.post('/categorias').set(auth(tokenGestor)).send({ nome: tag('celulares') });
  const cat2 = await api.post('/categorias').set(auth(tokenGestor)).send({ nome: tag('acessorios') });
  const mar = await api.post('/marcas').set(auth(tokenGestor)).send({ nome: tag('Alfa') });
  const mar2 = await api.post('/marcas').set(auth(tokenGestor)).send({ nome: tag('Beta') });
  idCategoria = cat.body.id_categoria;
  idCategoria2 = cat2.body.id_categoria;
  idMarca = mar.body.id_marca;
  idMarca2 = mar2.body.id_marca;
});

afterAll(async () => {
  const produtos = await Produto.findAll({ where: { nome: { [Op.like]: `teste-${run}%` } } });
  const ids = produtos.map((p) => p.id_produto);
  await ReservaEstoque.destroy({ where: { id_produto: ids } });
  await Produto.destroy({ where: { id_produto: ids } });
  await Categoria.destroy({ where: { nome: { [Op.like]: `teste-${run}%` } } });
  await Marca.destroy({ where: { nome: { [Op.like]: `teste-${run}%` } } });
  fs.rmSync(process.env.UPLOAD_DIR as string, { recursive: true, force: true });
  await sequelize.close();
  redis.disconnect();
});

describe('autenticação e permissão (RNF03)', () => {
  it('leitura é pública', async () => {
    expect((await api.get('/produtos')).status).toBe(200);
    expect((await api.get('/categorias')).status).toBe(200);
    expect((await api.get('/marcas')).status).toBe(200);
  });

  it('escrita sem token é 401; token inválido ou expirado é 401', async () => {
    expect((await api.post('/produtos').send({})).status).toBe(401);
    expect((await api.post('/produtos').set(auth('lixo')).send({})).status).toBe(401);
    expect((await api.post('/produtos').set(auth(gerarTokenExpirado())).send({})).status).toBe(401);
  });

  it('cliente sem catalogo:gerenciar recebe 403 em toda escrita', async () => {
    const h = auth(tokenCliente);
    expect((await api.post('/produtos').set(h).send({})).status).toBe(403);
    expect((await api.patch('/produtos/1').set(h).send({ nome: 'x' })).status).toBe(403);
    expect((await api.delete('/produtos/1').set(h)).status).toBe(403);
    expect((await api.patch('/produtos/1/estoque').set(h).send({ ajuste: 1 })).status).toBe(403);
    expect((await api.put('/produtos/1/imagem').set(h)).status).toBe(403);
    expect((await api.post('/categorias').set(h).send({ nome: 'abc' })).status).toBe(403);
    expect((await api.post('/marcas').set(h).send({ nome: 'abc' })).status).toBe(403);
  });

  it('token expirado em rota pública vira visitante (não quebra a vitrine)', async () => {
    expect((await api.get('/produtos').set(auth(gerarTokenExpirado()))).status).toBe(200);
  });
});

describe('validação (RNF04)', () => {
  const h = () => auth(tokenGestor);

  it.each([
    [{ nome: 'x', preco: 10, id_marca: 1, id_categoria: 1 }],
    [{ nome: 'Produto', preco: -1, id_marca: 1, id_categoria: 1 }],
    [{ nome: 'Produto', preco: 10.999, id_marca: 1, id_categoria: 1 }],
    [{ nome: 'Produto', preco: '10', id_marca: 1, id_categoria: 1 }],
    [{ nome: 'Produto', preco: 10, estoque: -3, id_marca: 1, id_categoria: 1 }],
    [{ nome: 'Produto', preco: 10 }],
  ])('recusa produto inválido %j', async (corpo) => {
    expect((await api.post('/produtos').set(h()).send(corpo)).status).toBe(400);
  });

  it('recusa marca/categoria inexistente', async () => {
    const base = { nome: tag('orfao'), preco: 10 };
    const r1 = await api.post('/produtos').set(h()).send({ ...base, id_marca: 999999, id_categoria: idCategoria });
    const r2 = await api.post('/produtos').set(h()).send({ ...base, id_marca: idMarca, id_categoria: 999999 });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it('id inválido na rota é 400 e produto inexistente é 404', async () => {
    expect((await api.get('/produtos/abc')).status).toBe(400);
    expect((await api.get('/produtos/-1')).status).toBe(400);
    expect((await api.get('/produtos/999999999')).status).toBe(404);
  });

  it('PATCH sem campos é 400 e não aceita alterar estoque por ele', async () => {
    const p = await criarProduto('patch');
    expect((await api.patch(`/produtos/${p.id_produto}`).set(h()).send({})).status).toBe(400);
    await api.patch(`/produtos/${p.id_produto}`).set(h()).send({ estoque: 999, nome: tag('patch2') });
    expect(await estoqueDe(p.id_produto)).toBe(10);
  });

  it('JSON malformado vira 400 (não 500)', async () => {
    const r = await api.post('/produtos').set(h()).set('Content-Type', 'application/json').send('{"nome":"x"');
    expect(r.status).toBe(400);
  });

  it.each([
    ['precoMin=100&precoMax=10'],
    ['pagina=0'],
    ['limite=1000'],
    ['ordenar=aleatorio'],
    ['categoria=abc'],
    ['disponivel=talvez'],
  ])('recusa filtro inválido ?%s', async (qs) => {
    expect((await api.get(`/produtos?${qs}`)).status).toBe(400);
  });
});

describe('categorias e marcas (RF19)', () => {
  const h = () => auth(tokenGestor);

  it('nome duplicado é 409 (inclusive com caixa diferente de espaços)', async () => {
    const r = await api.post('/categorias').set(h()).send({ nome: `  ${tag('celulares')}  ` });
    expect(r.status).toBe(409);
    expect((await api.post('/marcas').set(h()).send({ nome: tag('Alfa') })).status).toBe(409);
  });

  it('CRUD completo de categoria', async () => {
    const criada = await api.post('/categorias').set(h()).send({ nome: tag('temp-cat'), icone: 'phone' });
    expect(criada.status).toBe(201);
    expect(criada.body).toMatchObject({ icone: 'phone', ativo: true });
    const id = criada.body.id_categoria;

    const editada = await api.patch(`/categorias/${id}`).set(h()).send({ nome: tag('temp-cat2') });
    expect(editada.body.nome).toBe(tag('temp-cat2'));
    expect((await api.get(`/categorias/${id}`)).status).toBe(200);
    expect((await api.delete(`/categorias/${id}`).set(h())).status).toBe(204);
    expect((await api.get(`/categorias/${id}`)).status).toBe(404);
  });

  it('CRUD completo de marca', async () => {
    const criada = await api.post('/marcas').set(h()).send({ nome: tag('temp-marca') });
    expect(criada.status).toBe(201);
    const id = criada.body.id_marca;
    expect((await api.patch(`/marcas/${id}`).set(h()).send({ ativo: false })).body.ativo).toBe(false);
    expect((await api.delete(`/marcas/${id}`).set(h())).status).toBe(204);
  });

  it('não exclui categoria/marca que tem produtos (409)', async () => {
    const cat = await api.post('/categorias').set(h()).send({ nome: tag('com-produto') });
    const p = await api
      .post('/produtos')
      .set(h())
      .send({ nome: tag('prod-cat'), preco: 5, id_marca: idMarca, id_categoria: cat.body.id_categoria });
    expect(p.status).toBe(201);
    expect((await api.delete(`/categorias/${cat.body.id_categoria}`).set(h())).status).toBe(409);
    expect((await api.delete(`/marcas/${idMarca}`).set(h())).status).toBe(409);
  });

  it('categoria inativa some da vitrine, mas o gestor enxerga com incluirInativos', async () => {
    const cat = await api.post('/categorias').set(h()).send({ nome: tag('inativa'), ativo: false });
    const id = cat.body.id_categoria;
    const publica = await api.get('/categorias');
    expect(publica.body.some((c: { id_categoria: number }) => c.id_categoria === id)).toBe(false);
    expect((await api.get(`/categorias/${id}`)).status).toBe(404);

    const gestor = await api.get('/categorias?incluirInativos=true').set(h());
    expect(gestor.body.some((c: { id_categoria: number }) => c.id_categoria === id)).toBe(true);
    const ignorado = await api.get('/categorias?incluirInativos=true').set(auth(tokenCliente));
    expect(ignorado.body.some((c: { id_categoria: number }) => c.id_categoria === id)).toBe(false);
  });
});

describe('produtos (RF10-RF14, RF17, RF21)', () => {
  const h = () => auth(tokenGestor);

  it('cria produto devolvendo marca, categoria e preço numérico', async () => {
    const r = await api
      .post('/produtos')
      .set(h())
      .send({ nome: `  ${tag('Phone X')}  `, descricao: 'Tela 6.1', preco: 1999.9, estoque: 7, destaque: true, id_marca: idMarca, id_categoria: idCategoria });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      nome: tag('Phone X'),
      preco: 1999.9,
      estoque: 7,
      destaque: true,
      ativo: true,
      imagem: null,
      marca: { id_marca: idMarca, nome: tag('Alfa') },
      categoria: { id_categoria: idCategoria, nome: tag('celulares') },
    });
    expect(typeof r.body.preco).toBe('number');
    expect(r.body.criado_em).toBeTruthy();
  });

  it('atualiza produto e a leitura pública reflete (cache invalidado)', async () => {
    const p = await criarProduto('atualiza', { preco: 500 });
    expect((await api.get(`/produtos/${p.id_produto}`)).body.preco).toBe(500);

    const r = await api.patch(`/produtos/${p.id_produto}`).set(h()).send({ preco: 450.5, id_marca: idMarca2 });
    expect(r.status).toBe(200);
    expect(r.body.marca.nome).toBe(tag('Beta'));

    const depois = await api.get(`/produtos/${p.id_produto}`);
    expect(depois.body.preco).toBe(450.5);
    expect(depois.body.marca.nome).toBe(tag('Beta'));
  });

  it('DELETE inativa: some para o público, continua para o gestor, e é idempotente', async () => {
    const p = await criarProduto('inativa');
    expect((await api.get(`/produtos/${p.id_produto}`)).status).toBe(200);

    expect((await api.delete(`/produtos/${p.id_produto}`).set(h())).status).toBe(204);
    expect((await api.delete(`/produtos/${p.id_produto}`).set(h())).status).toBe(204);

    expect((await api.get(`/produtos/${p.id_produto}`)).status).toBe(404);
    const gestor = await api.get(`/produtos/${p.id_produto}`).set(h());
    expect(gestor.status).toBe(200);
    expect(gestor.body.ativo).toBe(false);
    expect((await Produto.findByPk(p.id_produto))).not.toBeNull();
  });

  it('filtros, busca, ordenação e paginação', async () => {
    const cat = await api.post('/categorias').set(h()).send({ nome: tag('filtros') });
    const c = cat.body.id_categoria;
    const mk = (nome: string, preco: number, estoque: number, extra = {}) =>
      api.post('/produtos').set(h()).send({ nome: tag(nome), preco, estoque, id_marca: idMarca, id_categoria: c, ...extra });
    await mk('Galaxy 13 Pro', 3000, 5);
    await mk('Galaxy 12', 2000, 0);
    await mk('Moto 50%', 1000, 3);
    await mk('Moto G', 1500, 2, { ativo: false });

    const lista = async (qs: string) => (await api.get(`/produtos?categoria=${c}&${qs}`)).body;

    const tudo = await lista('');
    expect(tudo.paginacao).toEqual({ pagina: 1, limite: 12, total: 3, totalPaginas: 1 });

    expect((await lista('ordenar=preco_asc')).dados.map((p: { preco: number }) => p.preco)).toEqual([1000, 2000, 3000]);
    expect((await lista('ordenar=preco_desc')).dados.map((p: { preco: number }) => p.preco)).toEqual([3000, 2000, 1000]);
    expect((await lista('precoMin=1500&precoMax=2500')).dados).toHaveLength(1);
    expect((await lista('disponivel=true')).dados).toHaveLength(2);
    expect((await lista('busca=galaxy')).dados).toHaveLength(2);
    expect((await lista('busca=galaxy 13')).dados).toHaveLength(1); // "13" tem só 2 letras: LIKE funciona onde FULLTEXT falharia
    expect((await lista('busca=50%')).dados).toHaveLength(1);
    expect((await lista('busca=%')).dados).toHaveLength(1); // curinga é literal, não "tudo"
    expect((await lista(`busca=${encodeURIComponent("' OR 1=1 --")}`)).dados).toHaveLength(0);
    expect((await lista(`marca=${idMarca2}`)).dados).toHaveLength(0);

    const pag1 = await lista('limite=2&pagina=1&ordenar=preco_asc');
    const pag2 = await lista('limite=2&pagina=2&ordenar=preco_asc');
    expect(pag1.paginacao).toMatchObject({ total: 3, totalPaginas: 2 });
    expect(pag1.dados).toHaveLength(2);
    expect(pag2.dados).toHaveLength(1);

    const comInativos = await api.get(`/produtos?categoria=${c}&incluirInativos=true`).set(h());
    expect(comInativos.body.paginacao.total).toBe(4);
    const clienteTentando = await api.get(`/produtos?categoria=${c}&incluirInativos=true`).set(auth(tokenCliente));
    expect(clienteTentando.body.paginacao.total).toBe(3);
  });

  it('destaque e recentes só trazem ativos, respeitam limite', async () => {
    const d = await criarProduto('vitrine-destaque', { destaque: true });
    const i = await criarProduto('vitrine-inativo', { destaque: true, ativo: false });
    const destaques = await api.get('/produtos/destaque?limite=24');
    const ids = destaques.body.map((p: { id_produto: number }) => p.id_produto);
    expect(ids).toContain(d.id_produto);
    expect(ids).not.toContain(i.id_produto);
    expect(destaques.body.every((p: { destaque: boolean }) => p.destaque)).toBe(true);

    const recentes = await api.get('/produtos/recentes?limite=3');
    expect(recentes.status).toBe(200);
    expect(recentes.body.length).toBeLessThanOrEqual(3);
    expect((await api.get('/produtos/recentes?limite=99')).status).toBe(400);
  });
});

describe('estoque administrativo', () => {
  const h = () => auth(tokenGestor);

  it('ajusta para cima e para baixo, sem deixar negativo', async () => {
    const p = await criarProduto('ajuste', { estoque: 5 });
    expect((await api.patch(`/produtos/${p.id_produto}/estoque`).set(h()).send({ ajuste: 10 })).body.estoque).toBe(15);
    expect((await api.patch(`/produtos/${p.id_produto}/estoque`).set(h()).send({ ajuste: -15 })).body.estoque).toBe(0);
    expect((await api.patch(`/produtos/${p.id_produto}/estoque`).set(h()).send({ ajuste: -1 })).status).toBe(409);
    expect((await api.patch(`/produtos/${p.id_produto}/estoque`).set(h()).send({ ajuste: 0 })).status).toBe(400);
    expect((await api.patch(`/produtos/${p.id_produto}/estoque`).set(h()).send({ ajuste: 1.5 })).status).toBe(400);
    expect((await api.patch('/produtos/999999999/estoque').set(h()).send({ ajuste: 1 })).status).toBe(404);
    expect(await estoqueDe(p.id_produto)).toBe(0);
  });
});

describe('imagens (RF15, RNF07)', () => {
  const h = () => auth(tokenGestor);

  it('envia PNG, serve o arquivo, troca (apaga a anterior) e remove', async () => {
    const p = await criarProduto('imagem');

    const r = await api.put(`/produtos/${p.id_produto}/imagem`).set(h()).attach('imagem', pngMinimo(), 'foto.png');
    expect(r.status).toBe(200);
    expect(r.body.imagem).toMatch(/^\/catalogo\/imagens\/[0-9a-f-]{36}\.png$/);

    const arquivo = r.body.imagem.replace('/catalogo/imagens', '/imagens');
    const servida = await api.get(arquivo);
    expect(servida.status).toBe(200);
    expect(servida.headers['content-type']).toMatch(/image\/png/);
    expect(servida.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const antigo = path.join(process.env.UPLOAD_DIR as string, path.basename(arquivo));
    expect(fs.existsSync(antigo)).toBe(true);

    const troca = await api.put(`/produtos/${p.id_produto}/imagem`).set(h()).attach('imagem', pngMinimo(), 'outra.png');
    expect(troca.body.imagem).not.toBe(r.body.imagem);
    expect(fs.existsSync(antigo)).toBe(false);

    expect((await api.delete(`/produtos/${p.id_produto}/imagem`).set(h())).status).toBe(204);
    expect((await api.get(`/produtos/${p.id_produto}`)).body.imagem).toBeNull();
    expect((await api.get(troca.body.imagem.replace('/catalogo/imagens', '/imagens'))).status).toBe(404);
  });

  it('recusa arquivo que não é imagem mesmo com nome/mimetype de imagem', async () => {
    const p = await criarProduto('imagem-falsa');
    const arquivosAntes = fs.readdirSync(process.env.UPLOAD_DIR as string).length;
    const r = await api
      .put(`/produtos/${p.id_produto}/imagem`)
      .set(h())
      .attach('imagem', Buffer.from('<?php system($_GET["c"]); ?>'), { filename: 'foto.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
    expect(fs.readdirSync(process.env.UPLOAD_DIR as string).length).toBe(arquivosAntes);
    expect((await api.get(`/produtos/${p.id_produto}`)).body.imagem).toBeNull();
  });

  it('recusa arquivo acima de 5 MB (413), requisição sem arquivo (400) e produto inexistente (404)', async () => {
    const p = await criarProduto('imagem-grande');
    const grande = Buffer.concat([pngMinimo(), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    expect((await api.put(`/produtos/${p.id_produto}/imagem`).set(h()).attach('imagem', grande, 'g.png')).status).toBe(413);
    expect((await api.put(`/produtos/${p.id_produto}/imagem`).set(h())).status).toBe(400);
    expect((await api.put('/produtos/999999999/imagem').set(h()).attach('imagem', pngMinimo(), 'a.png')).status).toBe(404);
  });

  it('nome de arquivo malicioso não escapa do diretório de imagens', async () => {
    expect((await api.get('/imagens/..%2f..%2fpackage.json')).status).toBe(404);
    expect((await api.get('/imagens/../package.json')).status).toBe(404);
  });
});

describe('cache-aside com Redis (rubrica)', () => {
  it('segunda leitura vem do cache, e escrita invalida', async () => {
    const p = await criarProduto('cache', { preco: 100 });
    await api.get(`/produtos/${p.id_produto}`);
    const chaves = await redis.keys('catalogo:*');
    expect(chaves.some((k) => k.endsWith(`produtos:${p.id_produto}`))).toBe(true);

    // altera direto no banco: se vier o valor antigo, veio do cache
    await Produto.update({ preco: 999 }, { where: { id_produto: p.id_produto } });
    expect((await api.get(`/produtos/${p.id_produto}`)).body.preco).toBe(100);

    await api.patch(`/produtos/${p.id_produto}`).set(auth(tokenGestor)).send({ nome: tag('cache-b') });
    expect((await api.get(`/produtos/${p.id_produto}`)).body.preco).toBe(999);
  });

  it('visão do gestor (inativos) não passa pelo cache', async () => {
    const p = await criarProduto('sem-cache', { preco: 100 });
    await Produto.update({ preco: 555 }, { where: { id_produto: p.id_produto } });
    await api.get(`/produtos/${p.id_produto}`);
    await Produto.update({ preco: 777 }, { where: { id_produto: p.id_produto } });
    const gestor = await api.get(`/produtos/${p.id_produto}`).set(auth(tokenGestor));
    expect(gestor.body.preco).toBe(777);
  });

  it('Redis fora do ar não derruba a API (degrada para o banco)', async () => {
    const p = await criarProduto('redis-fora');
    const get = jest.spyOn(redis, 'get').mockRejectedValue(new Error('redis caiu'));
    const set = jest.spyOn(redis, 'set').mockRejectedValue(new Error('redis caiu'));
    const incr = jest.spyOn(redis, 'incr').mockRejectedValue(new Error('redis caiu'));
    try {
      expect((await api.get(`/produtos/${p.id_produto}`)).status).toBe(200);
      expect((await api.get('/produtos')).status).toBe(200);
      const edicao = await api.patch(`/produtos/${p.id_produto}`).set(auth(tokenGestor)).send({ nome: tag('redis-fora-2') });
      expect(edicao.status).toBe(200);
    } finally {
      get.mockRestore();
      set.mockRestore();
      incr.mockRestore();
    }
  });
});

describe('rotas internas de estoque (ADR-009)', () => {
  it('exigem o token de serviço (JWT de usuário não basta)', async () => {
    const corpo = { id_pedido: novoPedido(), itens: [{ id_produto: 1, quantidade: 1 }] };
    expect((await api.post('/interno/reservas').send(corpo)).status).toBe(401);
    expect((await api.post('/interno/reservas').set(auth(tokenGestor)).send(corpo)).status).toBe(401);
    expect((await api.post('/interno/reservas').set({ 'x-service-token': 'errado' }).send(corpo)).status).toBe(401);
    expect((await api.post('/interno/reservas/1/devolucao')).status).toBe(401);
    expect((await api.get('/interno/produtos?ids=1')).status).toBe(401);
  });

  it('reserva baixa o estoque; repetir o mesmo pedido é idempotente', async () => {
    const a = await criarProduto('res-a', { estoque: 10 });
    const b = await criarProduto('res-b', { estoque: 4 });
    const pedido = novoPedido();
    const corpo = {
      id_pedido: pedido,
      itens: [
        { id_produto: b.id_produto, quantidade: 4 },
        { id_produto: a.id_produto, quantidade: 3 },
      ],
    };

    const r1 = await api.post('/interno/reservas').set(servico).send(corpo);
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ id_pedido: pedido, status: 'ATIVA' });
    expect(await estoqueDe(a.id_produto)).toBe(7);
    expect(await estoqueDe(b.id_produto)).toBe(0);

    const r2 = await api.post('/interno/reservas').set(servico).send(corpo);
    expect(r2.status).toBe(200);
    expect(await estoqueDe(a.id_produto)).toBe(7);

    const diferente = await api
      .post('/interno/reservas')
      .set(servico)
      .send({ id_pedido: pedido, itens: [{ id_produto: a.id_produto, quantidade: 1 }] });
    expect(diferente.status).toBe(409);

    const consulta = await api.get(`/interno/reservas/${pedido}`).set(servico);
    expect(consulta.body.itens).toHaveLength(2);
  });

  it('a vitrine pública enxerga o estoque novo depois da reserva (cache invalidado)', async () => {
    const p = await criarProduto('res-cache', { estoque: 5 });
    expect((await api.get(`/produtos/${p.id_produto}`)).body.estoque).toBe(5);
    await api.post('/interno/reservas').set(servico).send({ id_pedido: novoPedido(), itens: [{ id_produto: p.id_produto, quantidade: 2 }] });
    expect((await api.get(`/produtos/${p.id_produto}`)).body.estoque).toBe(3);
  });

  it('estoque insuficiente é tudo-ou-nada (409 com detalhes e nada baixado)', async () => {
    const a = await criarProduto('tn-a', { estoque: 10 });
    const b = await criarProduto('tn-b', { estoque: 1 });
    const pedido = novoPedido();
    const r = await api
      .post('/interno/reservas')
      .set(servico)
      .send({
        id_pedido: pedido,
        itens: [
          { id_produto: a.id_produto, quantidade: 5 },
          { id_produto: b.id_produto, quantidade: 2 },
        ],
      });
    expect(r.status).toBe(409);
    expect(r.body.detalhes).toEqual([{ id_produto: b.id_produto, solicitado: 2, disponivel: 1 }]);
    expect(await estoqueDe(a.id_produto)).toBe(10);
    expect(await estoqueDe(b.id_produto)).toBe(1);
    expect((await api.get(`/interno/reservas/${pedido}`).set(servico)).status).toBe(404);
  });

  it('produto inexistente é 404, inativo é 409, lista inválida é 400', async () => {
    const inativo = await criarProduto('res-inativo', { ativo: false });
    const ok = await criarProduto('res-ok', { estoque: 3 });
    const post = (itens: unknown[]) => api.post('/interno/reservas').set(servico).send({ id_pedido: novoPedido(), itens });

    expect((await post([{ id_produto: 999999999, quantidade: 1 }])).status).toBe(404);
    expect((await post([{ id_produto: inativo.id_produto, quantidade: 1 }])).status).toBe(409);
    expect((await post([])).status).toBe(400);
    expect((await post([{ id_produto: ok.id_produto, quantidade: 0 }])).status).toBe(400);
    expect((await post([{ id_produto: ok.id_produto, quantidade: -1 }])).status).toBe(400);
    expect(
      (await post([{ id_produto: ok.id_produto, quantidade: 1 }, { id_produto: ok.id_produto, quantidade: 1 }])).status
    ).toBe(400);
    expect(await estoqueDe(ok.id_produto)).toBe(3);
  });

  it('duas reservas simultâneas do último item: só uma vence (sem estoque negativo)', async () => {
    const p = await criarProduto('corrida', { estoque: 1 });
    const tentativas = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        api.post('/interno/reservas').set(servico).send({ id_pedido: novoPedido(), itens: [{ id_produto: p.id_produto, quantidade: 1 }] })
      )
    );
    const status = tentativas.map((t) => t.status).sort();
    expect(status.filter((s) => s === 201)).toHaveLength(1);
    expect(status.filter((s) => s === 409)).toHaveLength(4);
    expect(await estoqueDe(p.id_produto)).toBe(0);
  });

  it('a mesma reserva enviada em paralelo baixa o estoque uma única vez', async () => {
    const p = await criarProduto('paralelo', { estoque: 10 });
    const corpo = { id_pedido: novoPedido(), itens: [{ id_produto: p.id_produto, quantidade: 4 }] };
    const respostas = await Promise.all([1, 2, 3].map(() => api.post('/interno/reservas').set(servico).send(corpo)));
    expect(respostas.every((r) => [200, 201, 409].includes(r.status))).toBe(true);
    expect(respostas.some((r) => r.status === 201)).toBe(true);
    expect(await estoqueDe(p.id_produto)).toBe(6);
  });

  it('devolução repõe o estoque uma única vez e depois bloqueia nova reserva do pedido', async () => {
    const p = await criarProduto('devolve', { estoque: 6 });
    const pedido = novoPedido();
    const corpo = { id_pedido: pedido, itens: [{ id_produto: p.id_produto, quantidade: 4 }] };
    await api.post('/interno/reservas').set(servico).send(corpo);
    expect(await estoqueDe(p.id_produto)).toBe(2);

    const d1 = await api.post(`/interno/reservas/${pedido}/devolucao`).set(servico);
    expect(d1.status).toBe(200);
    expect(d1.body.status).toBe('DEVOLVIDA');
    expect(await estoqueDe(p.id_produto)).toBe(6);

    const d2 = await api.post(`/interno/reservas/${pedido}/devolucao`).set(servico);
    expect(d2.status).toBe(200);
    expect(await estoqueDe(p.id_produto)).toBe(6);

    expect((await api.post('/interno/reservas').set(servico).send(corpo)).status).toBe(409);
    expect((await api.post(`/interno/reservas/${novoPedido()}/devolucao`).set(servico)).status).toBe(404);
  });

  it('consulta em lote de produtos devolve preço/estoque atuais, inclusive inativos, sem cache', async () => {
    const a = await criarProduto('lote-a', { preco: 10, estoque: 3 });
    const b = await criarProduto('lote-b', { preco: 20, ativo: false });
    const r = await api.get(`/interno/produtos?ids=${a.id_produto},${b.id_produto},999999999`).set(servico);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(2);
    expect(r.body[0]).toMatchObject({ id_produto: a.id_produto, preco: 10, estoque: 3, ativo: true });
    expect(r.body[1]).toMatchObject({ id_produto: b.id_produto, ativo: false });
    expect((await api.get('/interno/produtos?ids=abc').set(servico)).status).toBe(400);
    expect((await api.get('/interno/produtos').set(servico)).status).toBe(400);
  });
});

describe('observabilidade (RNF11)', () => {
  it('/health/live e /health respondem', async () => {
    expect((await api.get('/health/live')).body).toEqual({ status: 'ok', servico: 'catalogo-service' });
    const pronto = await api.get('/health');
    expect(pronto.status).toBe(200);
    expect(pronto.body).toMatchObject({ banco: 'ok', servico: 'catalogo-service' });
  });

  it('/metrics exige token e expõe métricas de negócio e de cache', async () => {
    expect((await api.get('/metrics')).status).toBe(401);
    const r = await api.get('/metrics').set({ Authorization: 'Bearer token-de-teste' });
    expect(r.status).toBe(200);
    expect(r.text).toContain('catalogo_eventos_total');
    expect(r.text).toContain('catalogo_cache_total');
    expect(r.text).toContain('http_requisicoes_total');
  });

  it('propaga o x-correlation-id e rota desconhecida é 404 padronizado', async () => {
    const r = await api.get('/nao-existe').set('x-correlation-id', 'abc-123');
    expect(r.status).toBe(404);
    expect(r.headers['x-correlation-id']).toBe('abc-123');
    expect(r.body).toEqual({ erro: 'Rota não encontrada' });
  });
});
