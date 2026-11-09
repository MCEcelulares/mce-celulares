import { Op } from 'sequelize';
import { NotificacaoLog } from '../src/models';
import { enviarEmail } from '../src/services/emailService';
import { reenviarNotificacoes, esperaEmMinutos } from '../src/services/notificacaoService';

const logMock = NotificacaoLog as unknown as Record<string, jest.Mock>;
const emailMock = enviarEmail as jest.Mock;

const agora = new Date('2026-10-31T12:00:00.000Z');
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000);

const registro = (extra: Record<string, unknown> = {}) => {
  const log: Record<string, unknown> = {
    id_notificacao: 1,
    id_pedido: 123,
    tipo: 'PEDIDO_CRIADO',
    destinatario: 'fulano@mce.test',
    assunto: 'Recebemos o seu pedido #123',
    texto: 'Olá, Fulano!',
    status: 'FALHA',
    tentativas: 1,
    criado_em: minutosAtras(3),
    ...extra,
  };
  log.update = jest.fn(async (novo: Record<string, unknown>) => {
    Object.assign(log, novo);
  });
  return log;
};

beforeEach(() => {
  jest.resetAllMocks();
  emailMock.mockResolvedValue(undefined);
  logMock.update.mockResolvedValue([1]);
  delete process.env.NOTIFICACAO_REENVIO_MAX_TENTATIVAS;
});

describe('espera entre as rodadas', () => {
  it.each([
    [0, 2],
    [1, 2],
    [2, 4],
    [3, 8],
    [5, 32],
    [6, 60],
    [20, 60],
  ])('depois de %s rodada(s) espera %s minutos (dobra a cada rodada, teto de 60)', (rodadas, minutos) => {
    expect(esperaEmMinutos(rodadas)).toBe(minutos);
  });
});

describe('reenvio automático de notificações', () => {
  it('só considera FALHA e PENDENTE, abaixo do máximo de rodadas e com o conteúdo guardado', async () => {
    logMock.findAll.mockResolvedValue([]);
    await reenviarNotificacoes(agora);

    const consulta = logMock.findAll.mock.calls[0][0];
    expect(consulta.where).toEqual({
      status: { [Op.in]: ['FALHA', 'PENDENTE'] },
      tentativas: { [Op.lt]: 5 },
      assunto: { [Op.ne]: null },
      texto: { [Op.ne]: null },
    });
    expect(consulta.limit).toBe(20);
  });

  it('o máximo de rodadas é configurável', async () => {
    process.env.NOTIFICACAO_REENVIO_MAX_TENTATIVAS = '2';
    logMock.findAll.mockResolvedValue([]);
    await reenviarNotificacoes(agora);
    expect(logMock.findAll.mock.calls[0][0].where.tentativas).toEqual({ [Op.lt]: 2 });
  });

  it('reenvia uma FALHA que já esperou o tempo devido, com o conteúdo guardado, e marca como ENVIADO', async () => {
    const falha = registro({ tentativas: 1, criado_em: minutosAtras(3) }); // espera 2 min: passou
    logMock.findAll.mockResolvedValue([falha]);

    expect(await reenviarNotificacoes(agora)).toBe(1);

    expect(emailMock).toHaveBeenCalledWith({
      para: 'fulano@mce.test',
      assunto: 'Recebemos o seu pedido #123',
      texto: 'Olá, Fulano!',
    });
    expect(falha.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ENVIADO', tentativas: 2 }));
  });

  it('reivindica a notificação com UPDATE condicional (só uma instância envia)', async () => {
    const falha = registro();
    logMock.findAll.mockResolvedValue([falha]);

    await reenviarNotificacoes(agora);

    expect(logMock.update).toHaveBeenCalledWith(
      { status: 'PENDENTE', erro: null, criado_em: agora },
      { where: { id_notificacao: 1, status: 'FALHA', criado_em: minutosAtras(3) } }
    );
  });

  it('se outra instância já reivindicou, não envia', async () => {
    logMock.findAll.mockResolvedValue([registro()]);
    logMock.update.mockResolvedValue([0]);

    expect(await reenviarNotificacoes(agora)).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();
  });

  it('não reenvia antes da hora: a espera dobra a cada rodada', async () => {
    logMock.findAll.mockResolvedValue([
      registro({ id_notificacao: 1, tentativas: 1, criado_em: minutosAtras(1) }), // espera 2 min
      registro({ id_notificacao: 2, tentativas: 3, criado_em: minutosAtras(5) }), // espera 8 min
    ]);
    expect(await reenviarNotificacoes(agora)).toBe(0);
    expect(emailMock).not.toHaveBeenCalled();

    logMock.findAll.mockResolvedValue([registro({ id_notificacao: 2, tentativas: 3, criado_em: minutosAtras(9) })]);
    expect(await reenviarNotificacoes(agora)).toBe(1);
  });

  it('um PENDENTE recente é de outro processo ainda enviando; um PENDENTE preso por mais de 10 minutos é refeito', async () => {
    logMock.findAll.mockResolvedValue([registro({ status: 'PENDENTE', tentativas: 0, criado_em: minutosAtras(2) })]);
    expect(await reenviarNotificacoes(agora)).toBe(0);

    const preso = registro({ status: 'PENDENTE', tentativas: 0, criado_em: minutosAtras(11) });
    logMock.findAll.mockResolvedValue([preso]);
    expect(await reenviarNotificacoes(agora)).toBe(1);
    expect(preso.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ENVIADO' }));
  });

  it('se falhar de novo volta para FALHA, com mais uma rodada contada e o motivo', async () => {
    const falha = registro({ tentativas: 1 });
    logMock.findAll.mockResolvedValue([falha]);
    emailMock.mockRejectedValue(new Error('smtp fora do ar'));

    expect(await reenviarNotificacoes(agora)).toBe(1);

    expect(emailMock).toHaveBeenCalledTimes(3); // as 3 tentativas da rodada
    expect(falha.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'FALHA', erro: 'smtp fora do ar', tentativas: 2 })
    );
  });

  it('ao chegar na última rodada fica em FALHA definitiva (a consulta deixa de selecioná-la)', async () => {
    const ultima = registro({ tentativas: 4, criado_em: minutosAtras(40) });
    logMock.findAll.mockResolvedValue([ultima]);
    emailMock.mockRejectedValue(new Error('smtp fora do ar'));

    await reenviarNotificacoes(agora);

    expect(ultima.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'FALHA', tentativas: 5 }));
    // com 5 rodadas, tentativas < 5 já não é verdade: não volta a ser candidata
    expect(logMock.findAll.mock.calls[0][0].where.tentativas).toEqual({ [Op.lt]: 5 });
  });

  it('processa uma de cada vez, na ordem da consulta', async () => {
    logMock.findAll.mockResolvedValue([
      registro({ id_notificacao: 1, destinatario: 'a@mce.test' }),
      registro({ id_notificacao: 2, destinatario: 'b@mce.test' }),
    ]);
    expect(await reenviarNotificacoes(agora)).toBe(2);
    expect(emailMock.mock.calls.map((c) => c[0].para)).toEqual(['a@mce.test', 'b@mce.test']);
  });
});
