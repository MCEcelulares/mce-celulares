import { Op, UniqueConstraintError } from 'sequelize';
import { NotificacaoLog } from '../src/models';
import * as notificacaoLogRepository from '../src/repositories/notificacaoLogRepository';
import { RegistroDuplicadoError } from '../src/repositories/erros';

const modelo = NotificacaoLog as unknown as Record<string, jest.Mock>;

beforeEach(() => jest.resetAllMocks());

describe('notificacaoLogRepository', () => {
  it('traduz a violação do UNIQUE (id_pedido, tipo) em RegistroDuplicadoError', async () => {
    modelo.create.mockRejectedValue(new UniqueConstraintError({}));
    await expect(
      notificacaoLogRepository.criar({
        id_pedido: 1,
        tipo: 'PEDIDO_CRIADO',
        destinatario: 'a@b.c',
        assunto: 'x',
        texto: 'y',
        status: 'PENDENTE',
      })
    ).rejects.toBeInstanceOf(RegistroDuplicadoError);
  });

  it('não esconde outros erros do banco', async () => {
    const falha = new Error('banco fora do ar');
    modelo.create.mockRejectedValue(falha);
    await expect(
      notificacaoLogRepository.criar({
        id_pedido: 1,
        tipo: 'PEDIDO_CRIADO',
        destinatario: 'a@b.c',
        assunto: 'x',
        texto: 'y',
        status: 'PENDENTE',
      })
    ).rejects.toBe(falha);
  });

  it('busca por pedido e tipo', async () => {
    modelo.findOne.mockResolvedValue({ id_notificacao: 3 });
    expect(await notificacaoLogRepository.buscarPorPedidoETipo(7, 'PEDIDO_CRIADO')).toEqual({ id_notificacao: 3 });
    expect(modelo.findOne).toHaveBeenCalledWith({ where: { id_pedido: 7, tipo: 'PEDIDO_CRIADO' } });
  });

  it('atualiza a própria instância', async () => {
    const log = { update: jest.fn().mockResolvedValue('ok') } as unknown as NotificacaoLog;
    await notificacaoLogRepository.atualizar(log, { status: 'ENVIADO' });
    expect(log.update).toHaveBeenCalledWith({ status: 'ENVIADO' });
  });

  it('busca os reenviáveis: FALHA ou PENDENTE, abaixo do limite de rodadas, com conteúdo guardado, do mais antigo ao mais novo', async () => {
    modelo.findAll.mockResolvedValue([]);
    await notificacaoLogRepository.buscarReenviaveis({ maximoDeRodadas: 5, limite: 20 });
    expect(modelo.findAll).toHaveBeenCalledWith({
      where: {
        status: { [Op.in]: ['FALHA', 'PENDENTE'] },
        tentativas: { [Op.lt]: 5 },
        assunto: { [Op.ne]: null },
        texto: { [Op.ne]: null },
      },
      order: [['criado_em', 'ASC']],
      limit: 20,
    });
  });

  it('reivindica o reenvio com UPDATE condicional no status e no criado_em lidos, e diz se conseguiu', async () => {
    const criadoEm = new Date('2026-11-01T10:00:00Z');
    const agora = new Date('2026-11-01T11:00:00Z');
    const log = { id_notificacao: 9, status: 'FALHA', criado_em: criadoEm } as unknown as NotificacaoLog;
    modelo.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([0]);

    expect(await notificacaoLogRepository.reivindicarReenvio(log, agora)).toBe(true);
    expect(modelo.update).toHaveBeenCalledWith(
      { status: 'PENDENTE', erro: null, criado_em: agora },
      { where: { id_notificacao: 9, status: 'FALHA', criado_em: criadoEm } }
    );
    expect(await notificacaoLogRepository.reivindicarReenvio(log, agora)).toBe(false);
  });

  it('lista por pedido sem o texto do e-mail, em ordem de criação', async () => {
    modelo.findAll.mockResolvedValue(['a']);
    expect(await notificacaoLogRepository.listarPorPedido(4)).toEqual(['a']);
    expect(modelo.findAll).toHaveBeenCalledWith({
      where: { id_pedido: 4 },
      attributes: { exclude: ['texto'] },
      order: [['id_notificacao', 'ASC']],
    });
  });
});
