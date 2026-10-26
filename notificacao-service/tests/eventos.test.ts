import { UniqueConstraintError } from 'sequelize';
import { NotificacaoLog } from '../src/models';
import { enviarEmail } from '../src/services/emailService';
import { tratarMensagem } from '../src/services/assinanteService';

const logMock = NotificacaoLog as unknown as { create: jest.Mock };
const emailMock = enviarEmail as jest.Mock;

const cliente = { nome: 'Fulano', email: 'fulano@mce.test' };

const evento = (tipo: string, dados: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'a3c1f1de-0000-4000-8000-000000000001',
    tipo,
    versao: 1,
    origem: 'teste',
    ocorridoEm: new Date().toISOString(),
    dados,
    ...extra,
  });

const pedidoCriado = { idPedido: 123, status: 'AGUARDANDO_PAGAMENTO', valorTotal: 2599.9, cliente };
const pagamentoConfirmado = { idPedido: 123, valor: 2599.9, metodoPagamento: 'PIX', cliente };

let log: { update: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  log = { update: jest.fn().mockResolvedValue(undefined) };
  logMock.create.mockResolvedValue(log);
  emailMock.mockResolvedValue(undefined);
});

describe('pedido.criado', () => {
  it('registra, envia o e-mail e marca como ENVIADO', async () => {
    await tratarMensagem('pedido.criado', evento('pedido.criado', pedidoCriado));

    expect(logMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_pedido: 123, tipo: 'PEDIDO_CRIADO', destinatario: 'fulano@mce.test' })
    );
    expect(emailMock).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'fulano@mce.test', assunto: expect.stringContaining('#123') })
    );
    expect(log.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'ENVIADO' }));
  });

  it('ignora evento duplicado (UNIQUE id_pedido + tipo)', async () => {
    logMock.create.mockRejectedValueOnce(new UniqueConstraintError({}));
    await tratarMensagem('pedido.criado', evento('pedido.criado', pedidoCriado));
    expect(emailMock).not.toHaveBeenCalled();
  });

  it('marca como FALHA quando o envio do e-mail falha', async () => {
    emailMock.mockRejectedValueOnce(new Error('smtp fora do ar'));
    await tratarMensagem('pedido.criado', evento('pedido.criado', pedidoCriado));
    expect(log.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'FALHA', erro: 'smtp fora do ar' }));
  });
});

describe('pagamento.confirmado', () => {
  it('registra e envia o e-mail de pagamento', async () => {
    await tratarMensagem('pagamento.confirmado', evento('pagamento.confirmado', pagamentoConfirmado));

    expect(logMock.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'PAGAMENTO_CONFIRMADO' }));
    expect(emailMock).toHaveBeenCalledWith(
      expect.objectContaining({ assunto: expect.stringContaining('Pagamento confirmado') })
    );
  });
});

describe('eventos fora do contrato (ADR-008)', () => {
  const naoProcessa = async (canal: string, mensagem: string) => {
    await tratarMensagem(canal, mensagem);
    expect(logMock.create).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  };

  it('descarta JSON inválido', () => naoProcessa('pedido.criado', '{nao-e-json'));

  it('descarta envelope incompleto', () => naoProcessa('pedido.criado', JSON.stringify({ tipo: 'pedido.criado' })));

  it('descarta quando o tipo difere do canal', () =>
    naoProcessa('pedido.criado', evento('pagamento.confirmado', pedidoCriado)));

  it('descarta versão não suportada', () =>
    naoProcessa('pedido.criado', evento('pedido.criado', pedidoCriado, { versao: 2 })));

  it('descarta dados sem e-mail do cliente', () =>
    naoProcessa('pedido.criado', evento('pedido.criado', { ...pedidoCriado, cliente: { nome: 'Fulano' } })));
});
