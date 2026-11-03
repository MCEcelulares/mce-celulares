jest.unmock('../src/clients/catalogoClient');
jest.unmock('../src/clients/identidadeClient');

import * as catalogo from '../src/clients/catalogoClient';
import * as identidade from '../src/clients/identidadeClient';
import { ErroHttp } from '../src/middlewares/errorHandler';

const resposta = (status: number, corpo?: unknown) =>
  ({
    status,
    json: async () => {
      if (corpo === undefined) throw new Error('sem corpo');
      return corpo;
    },
  }) as Response;

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchMock.mockRestore();
  process.env.CATALOGO_SERVICE_TOKEN = 'token-do-catalogo-teste';
});

const rejeitaCom = async (promessa: Promise<unknown>, status: number) => {
  const erro = await promessa.then(
    () => null,
    (e) => e
  );
  expect(erro).toBeInstanceOf(ErroHttp);
  expect((erro as ErroHttp).status).toBe(status);
};

describe('Catálogo — buscarProduto', () => {
  it('consulta o produto pela URL configurada', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_produto: 10, nome: 'iPhone', preco: 100, estoque: 3, ativo: true }));
    const produto = await catalogo.buscarProduto(10);
    expect(produto).toMatchObject({ id_produto: 10, estoque: 3 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://catalogo.test:3002/produtos/10');
  });

  it('devolve null quando o Catálogo responde 404', async () => {
    fetchMock.mockResolvedValue(resposta(404, { erro: 'Produto não existe' }));
    expect(await catalogo.buscarProduto(10)).toBeNull();
  });

  it('tenta de novo uma vez após falha de rede', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(resposta(200, { id_produto: 10 }));
    expect(await catalogo.buscarProduto(10)).toMatchObject({ id_produto: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tenta de novo uma vez após 5xx e vira 503 se persistir', async () => {
    fetchMock.mockResolvedValue(resposta(500));
    await rejeitaCom(catalogo.buscarProduto(10), 503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('vira 503 quando o serviço está inacessível', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await rejeitaCom(catalogo.buscarProduto(10), 503);
  });

  it('respeita o timeout (HTTP_TIMEOUT_MS) e vira 503', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('timeout')));
        })
    );
    await rejeitaCom(catalogo.buscarProduto(10), 503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('vira 502 diante de uma resposta inesperada', async () => {
    fetchMock.mockResolvedValue(resposta(418, {}));
    await rejeitaCom(catalogo.buscarProduto(10), 502);
  });
});

describe('Catálogo — baixarEstoque e reporEstoque', () => {
  it('chama a baixa com o token de serviço e a quantidade', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_produto: 10, estoque: 1 }));
    expect(await catalogo.baixarEstoque(10, 2)).toBe('ok');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://catalogo.test:3002/produtos/10/estoque/baixa');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-do-catalogo-teste');
    expect(JSON.parse(init.body)).toEqual({ quantidade: 2 });
  });

  it.each([
    [409, 'insuficiente'],
    [404, 'inexistente'],
  ])('traduz %s em "%s"', async (status, esperado) => {
    fetchMock.mockResolvedValue(resposta(status, { erro: 'x' }));
    expect(await catalogo.baixarEstoque(10, 2)).toBe(esperado);
  });

  it('NÃO repete a baixa em caso de falha (não é idempotente)', async () => {
    fetchMock.mockResolvedValue(resposta(500));
    await rejeitaCom(catalogo.baixarEstoque(10, 2), 503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('vira 502 com resposta inesperada (ex.: token de serviço recusado)', async () => {
    fetchMock.mockResolvedValue(resposta(401, { erro: 'Token de serviço inválido' }));
    await rejeitaCom(catalogo.baixarEstoque(10, 2), 502);
  });

  it('falha com 503 sem chamar o Catálogo se o token de serviço não estiver configurado', async () => {
    delete process.env.CATALOGO_SERVICE_TOKEN;
    await rejeitaCom(catalogo.baixarEstoque(10, 2), 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reporEstoque chama a rota de reposição e falha com 502 se não for 200', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_produto: 10, estoque: 5 }));
    await catalogo.reporEstoque(10, 2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://catalogo.test:3002/produtos/10/estoque/reposicao');

    fetchMock.mockResolvedValue(resposta(404, {}));
    await rejeitaCom(catalogo.reporEstoque(10, 2), 502);
  });
});

describe('Identidade', () => {
  const token = 'Bearer jwt-do-usuario';

  it('repassa o token do usuário ao buscar o usuário e o endereço', async () => {
    fetchMock.mockResolvedValue(resposta(200, { id_usuario: 5, nome: 'Rafael' }));

    expect(await identidade.buscarUsuario(5, token)).toMatchObject({ id_usuario: 5 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://identidade.test:3001/usuarios/5');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(token);

    await identidade.buscarEndereco(5, 3, token);
    expect(fetchMock.mock.calls[1][0]).toBe('http://identidade.test:3001/usuarios/5/enderecos/3');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(token);
  });

  it.each([401, 403, 404])('devolve null quando o Identidade responde %s', async (status) => {
    fetchMock.mockResolvedValue(resposta(status, { erro: 'x' }));
    expect(await identidade.buscarUsuario(5, token)).toBeNull();
    expect(await identidade.buscarEndereco(5, 3, token)).toBeNull();
  });

  it('vira 503 quando o Identidade está fora do ar e 502 com resposta inesperada', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await rejeitaCom(identidade.buscarUsuario(5, token), 503);

    fetchMock.mockResolvedValue(resposta(418, {}));
    await rejeitaCom(identidade.buscarUsuario(5, token), 502);
  });
});
