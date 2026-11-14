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

const itens = [
  { id_produto: 10, quantidade: 2 },
  { id_produto: 11, quantidade: 1 },
];

describe('Catálogo — reservarEstoque', () => {
  it('chama /interno/reservas com o token de serviço, o id do pedido e os itens', async () => {
    fetchMock.mockResolvedValue(resposta(201, { id_pedido: 5 }));
    expect(await catalogo.reservarEstoque(5, itens)).toEqual({ tipo: 'ok' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://catalogo.test:3002/interno/reservas');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-do-catalogo-teste');
    expect(JSON.parse(init.body)).toEqual({ id_pedido: 5, itens });
  });

  it('200 (reserva repetida para o mesmo pedido) também é ok', async () => {
    fetchMock.mockResolvedValue(resposta(200, {}));
    expect(await catalogo.reservarEstoque(5, itens)).toEqual({ tipo: 'ok' });
  });

  it('409 "Estoque insuficiente" devolve as faltas', async () => {
    const faltas = [{ id_produto: 10, solicitado: 2, disponivel: 1 }];
    fetchMock.mockResolvedValue(resposta(409, { erro: 'Estoque insuficiente', detalhes: faltas }));
    expect(await catalogo.reservarEstoque(5, itens)).toEqual({ tipo: 'sem_estoque', faltas });
  });

  it.each([
    [404, 'Produto(s) não existe(m): 10'],
    [409, 'Produto(s) indisponível(is): 10'],
  ])('%s vira "recusada" com a mensagem do Catálogo', async (status, mensagem) => {
    fetchMock.mockResolvedValue(resposta(status, { erro: mensagem }));
    expect(await catalogo.reservarEstoque(5, itens)).toEqual({ tipo: 'recusada', status, mensagem });
  });

  it('repete a chamada em caso de falha (a reserva é idempotente por pedido)', async () => {
    fetchMock.mockResolvedValueOnce(resposta(500)).mockResolvedValueOnce(resposta(201, {}));
    expect(await catalogo.reservarEstoque(5, itens)).toEqual({ tipo: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('com o Catálogo fora do ar nas duas tentativas, vira 503', async () => {
    fetchMock.mockResolvedValue(resposta(500));
    await rejeitaCom(catalogo.reservarEstoque(5, itens), 503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('vira 502 com resposta inesperada (ex.: token de serviço recusado)', async () => {
    fetchMock.mockResolvedValue(resposta(401, { erro: 'Token de serviço inválido' }));
    await rejeitaCom(catalogo.reservarEstoque(5, itens), 502);
  });

  it('falha com 503 sem chamar o Catálogo se o token de serviço não estiver configurado', async () => {
    delete process.env.CATALOGO_SERVICE_TOKEN;
    await rejeitaCom(catalogo.reservarEstoque(5, itens), 503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Catálogo — devolverReserva', () => {
  it('chama a devolução do pedido com o token de serviço', async () => {
    fetchMock.mockResolvedValue(resposta(200, {}));
    await catalogo.devolverReserva(5);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://catalogo.test:3002/interno/reservas/5/devolucao');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-do-catalogo-teste');
  });

  it('404 (não havia reserva) não é erro', async () => {
    fetchMock.mockResolvedValue(resposta(404, { erro: 'Reserva não encontrada' }));
    await expect(catalogo.devolverReserva(5)).resolves.toBeUndefined();
  });

  it('repete em caso de falha e falha com 502 em outra resposta inesperada', async () => {
    fetchMock.mockResolvedValueOnce(resposta(500)).mockResolvedValueOnce(resposta(200, {}));
    await catalogo.devolverReserva(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(resposta(401, {}));
    await rejeitaCom(catalogo.devolverReserva(5), 502);
  });

  it('falha com 503 sem chamar o Catálogo se o token de serviço não estiver configurado', async () => {
    delete process.env.CATALOGO_SERVICE_TOKEN;
    await rejeitaCom(catalogo.devolverReserva(5), 503);
    expect(fetchMock).not.toHaveBeenCalled();
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
