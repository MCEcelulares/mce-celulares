import request from 'supertest';
import jwt from 'jsonwebtoken';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { app } from '../src/app';
import { redis } from '../src/config/redis';
import { Produto, Categoria, Marca } from '../src/models';

const api = request(app);
const produtoMock = Produto as unknown as Record<string, jest.Mock>;
const categoriaMock = Categoria as unknown as Record<string, jest.Mock>;
const marcaMock = Marca as unknown as Record<string, jest.Mock>;
const pasta = process.env.UPLOAD_DIR as string;

const token = (permissoes: string[]) =>
  jwt.sign(
    { id_usuario: 1, email: 'a@mce.test', admin: false, cargos: [], permissoes },
    process.env.JWT_PRIVATE_KEY_TESTE as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
const admin = { Authorization: `Bearer ${token(['catalogo:gerenciar'])}` };
const painel = { Authorization: `Bearer ${token(['dashboard:ver'])}` };
const cliente = { Authorization: `Bearer ${token([])}` };

const preenchimento = Buffer.alloc(64);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), preenchimento]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), preenchimento]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), preenchimento]);

const arquivosNaPasta = () => readdirSync(pasta);

const produtoComImagem = (imagem: string | null = null) => {
  const dados: Record<string, unknown> = { id_produto: 1, imagem };
  return {
    ...dados,
    get imagem() {
      return dados.imagem;
    },
    update: jest.fn(async (novo: Record<string, unknown>) => {
      Object.assign(dados, novo);
    }),
  };
};

beforeAll(() => {
  jest.spyOn(Produto, 'findAndCountAll');
  jest.spyOn(Produto, 'findByPk');
  jest.spyOn(Produto, 'count');
  jest.spyOn(Produto, 'findOne');
  jest.spyOn(Categoria, 'findAll');
  jest.spyOn(Marca, 'findAll');
});

beforeEach(async () => {
  jest.resetAllMocks();
  await redis.flushall();
  for (const arquivo of arquivosNaPasta()) {
    // limpa só a pasta temporária desta execução
    require('fs').unlinkSync(path.join(pasta, arquivo));
  }
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('?incluirInativos=true (visão do painel)', () => {
  it.each(['/produtos', '/produtos/1', '/categorias', '/marcas'])('%s exige token e catalogo:gerenciar', async (rota) => {
    expect((await api.get(`${rota}?incluirInativos=true`)).status).toBe(401);
    produtoMock.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
    categoriaMock.findAll.mockResolvedValue([]);
    marcaMock.findAll.mockResolvedValue([]);
    const respostaCliente = await api.get(`${rota}?incluirInativos=true`).set(cliente);
    expect(respostaCliente.status).toBe(rota === '/produtos/1' ? 403 : 200);
  });

  it('a listagem de produtos inclui os inativos para o gestor, e continua só com ativos sem o parâmetro', async () => {
    produtoMock.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    expect((await api.get('/produtos?incluirInativos=true').set(admin)).status).toBe(200);
    expect(produtoMock.findAndCountAll.mock.calls[0][0].where).toEqual({});

    await api.get('/produtos');
    expect(produtoMock.findAndCountAll.mock.calls[1][0].where).toEqual({ ativo: true });

    await api.get('/produtos?incluirInativos=false');
    expect(produtoMock.findAndCountAll).toHaveBeenCalledTimes(2);
  });

  it('o detalhe de um produto inativo aparece para o gestor e não passa pelo cache', async () => {
    const linha = { toJSON: () => ({ id_produto: 1, nome: 'X', ativo: false, preco: '10.00' }) };
    produtoMock.findByPk.mockResolvedValue(linha);

    const r = await api.get('/produtos/1?incluirInativos=true').set(admin);

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id_produto: 1, ativo: false, preco: 10 });
    expect(await redis.get('produto:1')).toBeNull();
    expect(produtoMock.findOne).not.toHaveBeenCalled();
  });

  it('o detalhe de um produto inexistente responde 404 também na visão do painel', async () => {
    produtoMock.findByPk.mockResolvedValue(null);
    expect((await api.get('/produtos/1?incluirInativos=true').set(admin)).status).toBe(404);
  });

  it('categorias e marcas inativas aparecem para o gestor', async () => {
    categoriaMock.findAll.mockResolvedValue([]);
    marcaMock.findAll.mockResolvedValue([]);

    expect((await api.get('/categorias?incluirInativos=true').set(admin)).status).toBe(200);
    expect((await api.get('/marcas?incluirInativos=true').set(admin)).status).toBe(200);
    expect(categoriaMock.findAll.mock.calls[0][0].where).toEqual({});
    expect(marcaMock.findAll.mock.calls[0][0].where).toEqual({});

    await api.get('/categorias');
    expect(categoriaMock.findAll.mock.calls[1][0].where).toEqual({ ativo: true });
  });
});

describe('GET /produtos/resumo (painel, RF46)', () => {
  it('exige token e a permissão dashboard:ver', async () => {
    expect((await api.get('/produtos/resumo')).status).toBe(401);
    expect((await api.get('/produtos/resumo').set(cliente)).status).toBe(403);
    expect((await api.get('/produtos/resumo').set(admin)).status).toBe(403); // catalogo:gerenciar não basta
  });

  it('devolve as contagens do catálogo e o valor em estoque', async () => {
    produtoMock.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8) // ativos
      .mockResolvedValueOnce(2) // sem estoque
      .mockResolvedValueOnce(3); // destaque
    produtoMock.findOne.mockResolvedValue({ valor: '12345.60' });

    const r = await api.get('/produtos/resumo').set(painel);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      total_produtos: 10,
      produtos_ativos: 8,
      produtos_inativos: 2,
      produtos_sem_estoque: 2,
      produtos_em_destaque: 3,
      valor_em_estoque: 12345.6,
    });
    expect(produtoMock.count.mock.calls[2][0].where).toEqual({ ativo: true, estoque: 0 });
  });

  it('catálogo vazio devolve zeros', async () => {
    produtoMock.count.mockResolvedValue(0);
    produtoMock.findOne.mockResolvedValue({ valor: null });
    const r = await api.get('/produtos/resumo').set(painel);
    expect(r.body).toMatchObject({ total_produtos: 0, valor_em_estoque: 0 });
  });

  it('"resumo" não é tratado como id de produto', async () => {
    produtoMock.count.mockResolvedValue(0);
    produtoMock.findOne.mockResolvedValue(null);
    expect((await api.get('/produtos/resumo').set(painel)).status).toBe(200);
    expect(produtoMock.findByPk).not.toHaveBeenCalled();
  });
});

describe('POST /produtos/:id/imagem (RF15, RNF07)', () => {
  const enviar = (conteudo: Buffer, nome = 'foto.png', tipo = 'image/png', headers = admin, id = 1) =>
    api.post(`/produtos/${id}/imagem`).set(headers).attach('imagem', conteudo, { filename: nome, contentType: tipo });

  it.each([
    ['PNG', png, 'image/png', 'png'],
    ['JPEG', jpg, 'image/jpeg', 'jpg'],
    ['WEBP', webp, 'image/webp', 'webp'],
  ])('aceita %s, grava com nome gerado pelo servidor e atualiza o produto', async (_nome, conteudo, tipo, ext) => {
    const produto = produtoComImagem();
    produtoMock.findByPk.mockResolvedValue(produto);

    const r = await enviar(conteudo, 'nome-do-cliente.exe', tipo);

    expect(r.status).toBe(200);
    expect(r.body.id_produto).toBe(1);
    expect(r.body.imagem).toMatch(new RegExp(`^/catalogo/imagens/[0-9a-f-]{36}\\.${ext}$`));
    expect(r.body.imagem).not.toContain('nome-do-cliente');

    const gravado = arquivosNaPasta();
    expect(gravado).toHaveLength(1);
    expect(gravado[0]).toBe(path.basename(r.body.imagem));
    expect(produto.update).toHaveBeenCalledWith({ imagem: path.basename(r.body.imagem) });
  });

  it('invalida o cache do produto', async () => {
    await redis.set('catalogo:versao', '0');
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    await enviar(png);
    expect(await redis.get('catalogo:versao')).toBe('1');
  });

  it('exige token e catalogo:gerenciar antes de aceitar o arquivo', async () => {
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    const semToken = await api.post('/produtos/1/imagem').attach('imagem', png, { filename: 'a.png', contentType: 'image/png' });
    expect(semToken.status).toBe(401);
    expect((await enviar(png, 'a.png', 'image/png', cliente)).status).toBe(403);
    expect(arquivosNaPasta()).toHaveLength(0);
  });

  it('rejeita arquivo que diz ser imagem mas não é (confere os bytes) com 415', async () => {
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    const r = await enviar(Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png');
    expect(r.status).toBe(415);
    expect(arquivosNaPasta()).toHaveLength(0);
  });

  it.each(['text/plain', 'image/svg+xml', 'application/pdf', 'image/gif'])('rejeita o tipo %s com 415', async (tipo) => {
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    expect((await enviar(png, 'a.bin', tipo)).status).toBe(415);
    expect(arquivosNaPasta()).toHaveLength(0);
  });

  it('rejeita imagem maior que 2 MB com 413', async () => {
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    const grande = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await enviar(grande)).status).toBe(413);
    expect(arquivosNaPasta()).toHaveLength(0);
  });

  it('exige o arquivo no campo "imagem"', async () => {
    produtoMock.findByPk.mockResolvedValue(produtoComImagem());
    const semArquivo = await api.post('/produtos/1/imagem').set(admin);
    expect(semArquivo.status).toBe(400);
    const campoErrado = await api
      .post('/produtos/1/imagem')
      .set(admin)
      .attach('foto', png, { filename: 'a.png', contentType: 'image/png' });
    expect(campoErrado.status).toBe(400);
  });

  it('responde 404 para produto inexistente sem deixar arquivo no disco', async () => {
    produtoMock.findByPk.mockResolvedValue(null);
    expect((await enviar(png)).status).toBe(404);
    expect(arquivosNaPasta()).toHaveLength(0);
  });

  it('ao trocar a imagem remove o arquivo anterior', async () => {
    const anterior = '0b7a3c3e-1111-4222-8333-444455556666.png';
    writeFileSync(path.join(pasta, anterior), png);
    produtoMock.findByPk.mockResolvedValue(produtoComImagem(`/catalogo/imagens/${anterior}`));

    const r = await enviar(jpg, 'nova.jpg', 'image/jpeg');

    expect(r.status).toBe(200);
    expect(existsSync(path.join(pasta, anterior))).toBe(false);
    expect(arquivosNaPasta()).toEqual([path.basename(r.body.imagem)]);
  });

  it('não apaga nada quando a imagem anterior é uma URL externa ou tem caminho suspeito', async () => {
    const intocado = 'arquivo-que-nao-e-nosso.txt';
    writeFileSync(path.join(pasta, intocado), 'x');

    for (const anterior of ['https://cdn.exemplo.com/foto.png', '/catalogo/imagens/../arquivo-que-nao-e-nosso.txt', '/catalogo/imagens/arquivo-que-nao-e-nosso.txt']) {
      produtoMock.findByPk.mockResolvedValue(produtoComImagem(anterior));
      expect((await enviar(png)).status).toBe(200);
    }
    expect(existsSync(path.join(pasta, intocado))).toBe(true);
  });
});

describe('GET /imagens/* (arquivos enviados)', () => {
  it('serve a imagem com cache longo e liberada para outra origem (front em outro domínio)', async () => {
    const nome = '0b7a3c3e-1111-4222-8333-444455556666.png';
    writeFileSync(path.join(pasta, nome), png);

    const r = await api.get(`/imagens/${nome}`);

    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('image/png');
    expect(r.headers['cache-control']).toContain('immutable');
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('responde 404 para arquivo inexistente e não sai da pasta de imagens', async () => {
    expect((await api.get('/imagens/nao-existe.png')).status).toBe(404);
    expect((await api.get('/imagens/..%2F..%2Fpackage.json')).status).toBe(404);
    expect((await api.get('/imagens/%2e%2e/%2e%2e/package.json')).status).toBe(404);
  });

  it('não lista o conteúdo da pasta', async () => {
    expect((await api.get('/imagens/')).status).toBe(404);
  });
});
