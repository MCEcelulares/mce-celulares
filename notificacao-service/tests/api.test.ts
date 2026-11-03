import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { NotificacaoLog } from '../src/models';
import { enviarEmail } from '../src/services/emailService';

const api = request(app);
const logMock = NotificacaoLog as unknown as { findAll: jest.Mock };
const emailMock = enviarEmail as jest.Mock;

const token = (permissoes: string[]) =>
  jwt.sign(
    { id_usuario: 1, email: 'a@mce.test', admin: false, cargos: [], permissoes },
    process.env.TESTE_JWT_PRIVATE_KEY as string,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const contato = { nome: 'Maria Silva', email: 'maria@mce.test', mensagem: 'Quero saber sobre o frete.' };

beforeEach(() => {
  jest.clearAllMocks();
  emailMock.mockResolvedValue(undefined);
});

describe('POST /contato', () => {
  it('envia a mensagem para a loja e responde 202', async () => {
    const r = await api.post('/contato').send({ ...contato, assunto: 'Frete' });
    expect(r.status).toBe(202);
    expect(emailMock).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'loja@mce.test', responderPara: 'maria@mce.test' })
    );
  });

  it('rejeita dados inválidos com 400', async () => {
    const r = await api.post('/contato').send({ nome: 'M', email: 'nao-e-email', mensagem: '' });
    expect(r.status).toBe(400);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it('remove quebras de linha do assunto', async () => {
    await api.post('/contato').send({ ...contato, assunto: 'Oi\r\nBcc: x@y.com' });
    expect(emailMock.mock.calls[0][0].assunto).not.toMatch(/[\r\n]/);
  });

  it('responde 502 quando o SMTP falha', async () => {
    emailMock.mockRejectedValueOnce(new Error('smtp fora do ar'));
    const r = await api.post('/contato').send(contato);
    expect(r.status).toBe(502);
  });
});

describe('GET /logs/:idPedido', () => {
  it('exige token', async () => {
    expect((await api.get('/logs/1')).status).toBe(401);
  });

  it('rejeita token sem a permissão pedidos:listar-todos', async () => {
    const r = await api.get('/logs/1').set(auth(token([])));
    expect(r.status).toBe(403);
  });

  it('rejeita idPedido inválido com 400', async () => {
    const r = await api.get('/logs/abc').set(auth(token(['pedidos:listar-todos'])));
    expect(r.status).toBe(400);
  });

  it('lista as notificações do pedido', async () => {
    logMock.findAll.mockResolvedValue([{ id_notificacao: 1, id_pedido: 7, tipo: 'PEDIDO_CRIADO' }]);
    const r = await api.get('/logs/7').set(auth(token(['pedidos:listar-todos'])));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
  });

  it('responde 404 quando não há notificações', async () => {
    logMock.findAll.mockResolvedValue([]);
    const r = await api.get('/logs/7').set(auth(token(['pedidos:listar-todos'])));
    expect(r.status).toBe(404);
  });
});

describe('saúde e métricas', () => {
  it('GET /health/live responde 200', async () => {
    expect((await api.get('/health/live')).status).toBe(200);
  });

  it('GET /health responde 200 com o banco ok', async () => {
    const r = await api.get('/health');
    expect(r.status).toBe(200);
    expect(r.body.banco).toBe('ok');
  });

  it('GET /metrics exige o token de métricas', async () => {
    expect((await api.get('/metrics')).status).toBe(401);
    const r = await api.get('/metrics').set(auth('token-de-teste'));
    expect(r.status).toBe(200);
    expect(r.text).toContain('http_requisicoes_total');
  });

  it('rota inexistente responde 404', async () => {
    expect((await api.get('/nao-existe')).status).toBe(404);
  });
});
