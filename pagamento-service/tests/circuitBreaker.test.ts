import { chamar, estadoDoCircuito, reiniciarCircuitos } from '../src/clients/http';
import { ErroHttp } from '../src/middlewares/errorHandler';

const resposta = (status: number, corpo: unknown = {}) => ({ status, json: async () => corpo }) as Response;

let fetchMock: jest.SpyInstance;
let agora: number;
let relogio: jest.SpyInstance;

beforeEach(() => {
  reiniciarCircuitos();
  process.env.CIRCUIT_FALHAS = '3';
  process.env.CIRCUIT_RESET_MS = '10000';
  agora = 1_000_000;
  relogio = jest.spyOn(Date, 'now').mockImplementation(() => agora);
  fetchMock = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchMock.mockRestore();
  relogio.mockRestore();
  process.env.CIRCUIT_FALHAS = '1000';
  delete process.env.CIRCUIT_RESET_MS;
  delete process.env.HTTP_BACKOFF_BASE_MS;
  process.env.HTTP_BACKOFF_BASE_MS = '1';
});

const falhar = async (servico = 'Teste') => {
  const erro = await chamar(servico, 'http://x.test/a').then(
    () => null,
    (e) => e
  );
  expect(erro).toBeInstanceOf(ErroHttp);
  expect((erro as ErroHttp).status).toBe(503);
};

describe('circuit breaker', () => {
  it('abre depois de N falhas seguidas e recusa as chamadas seguintes sem tocar na rede', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await falhar();
    await falhar();
    expect(estadoDoCircuito('Teste')).toBe('fechado');
    await falhar();
    expect(estadoDoCircuito('Teste')).toBe('aberto');

    fetchMock.mockClear();
    await falhar();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uma resposta boa no meio zera a contagem de falhas', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar();
    await falhar();

    fetchMock.mockResolvedValue(resposta(200));
    await chamar('Teste', 'http://x.test/a');

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar();
    await falhar();
    expect(estadoDoCircuito('Teste')).toBe('fechado');
  });

  it('5xx conta como falha; 4xx é resposta válida e não conta', async () => {
    fetchMock.mockResolvedValue(resposta(404));
    for (let i = 0; i < 5; i++) await chamar('Teste', 'http://x.test/a');
    expect(estadoDoCircuito('Teste')).toBe('fechado');

    fetchMock.mockResolvedValue(resposta(500));
    await falhar();
    await falhar();
    await falhar();
    expect(estadoDoCircuito('Teste')).toBe('aberto');
  });

  it('depois do tempo de espera deixa passar UMA chamada de teste; se der certo, fecha', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar();
    await falhar();
    await falhar();

    agora += 10_000;
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(resposta(200, { ok: true }));

    const r = await chamar('Teste', 'http://x.test/a');
    expect(r.corpo).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(estadoDoCircuito('Teste')).toBe('fechado');
  });

  it('enquanto a chamada de teste está em andamento as outras continuam recusadas', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar();
    await falhar();
    await falhar();
    agora += 10_000;

    let liberar: (r: Response) => void = () => undefined;
    fetchMock.mockClear();
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (liberar = resolve)));

    const teste = chamar('Teste', 'http://x.test/a');
    expect(estadoDoCircuito('Teste')).toBe('meio-aberto');
    await falhar(); // recusada na hora: não chega ao fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);

    liberar(resposta(200));
    await teste;
    expect(estadoDoCircuito('Teste')).toBe('fechado');
  });

  it('se a chamada de teste falhar o circuito reabre e espera de novo', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar();
    await falhar();
    await falhar();

    agora += 10_000;
    await falhar(); // a chamada de teste falha
    expect(estadoDoCircuito('Teste')).toBe('aberto');

    fetchMock.mockClear();
    agora += 5_000; // ainda dentro da nova espera
    await falhar();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cada serviço tem o seu próprio circuito', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await falhar('A');
    await falhar('A');
    await falhar('A');
    expect(estadoDoCircuito('A')).toBe('aberto');
    expect(estadoDoCircuito('B')).toBe('fechado');

    fetchMock.mockResolvedValue(resposta(200));
    await expect(chamar('B', 'http://x.test/b')).resolves.toMatchObject({ status: 200 });
  });
});

describe('retry com backoff', () => {
  it('espera entre as tentativas (base 40ms) e só conta UMA falha para o circuito por chamada', async () => {
    process.env.HTTP_BACKOFF_BASE_MS = '40';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const inicio = process.hrtime.bigint();
    const erro = await chamar('Teste', 'http://x.test/a', { tentativas: 3 }).catch((e) => e);
    const gastoMs = Number(process.hrtime.bigint() - inicio) / 1e6;

    expect(erro).toBeInstanceOf(ErroHttp);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(gastoMs).toBeGreaterThanOrEqual(110); // 40ms + 80ms
    expect(estadoDoCircuito('Teste')).toBe('fechado'); // 1 falha < 3
  });

  it('para de tentar assim que uma tentativa dá certo', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(resposta(200, { ok: 1 }));
    const r = await chamar('Teste', 'http://x.test/a', { tentativas: 3 });
    expect(r.corpo).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
