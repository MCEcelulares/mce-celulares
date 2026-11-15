import { Op, UniqueConstraintError } from 'sequelize';
import { Pagamento } from '../src/models';
import * as pagamentoRepository from '../src/repositories/pagamentoRepository';
import { RegistroDuplicadoError } from '../src/repositories/erros';

const modelo = Pagamento as unknown as Record<string, jest.Mock>;

beforeEach(() => jest.resetAllMocks());

describe('pagamentoRepository', () => {
  it('busca o pagamento pelo id do pedido', async () => {
    modelo.findOne.mockResolvedValue({ id_pagamento: 1 });
    expect(await pagamentoRepository.buscarPorPedido(77)).toEqual({ id_pagamento: 1 });
    expect(modelo.findOne).toHaveBeenCalledWith({ where: { id_pedido: 77 } });
  });

  it('lista do mais novo para o mais antigo, com paginação e filtro opcional de status', async () => {
    modelo.findAndCountAll.mockResolvedValue({ rows: ['a'], count: 41 });

    const r = await pagamentoRepository.listar({ status: 'REEMBOLSAR', limite: 20, pagina: 3 });

    expect(r).toEqual({ registros: ['a'], total: 41 });
    expect(modelo.findAndCountAll).toHaveBeenCalledWith({
      where: { status: 'REEMBOLSAR' },
      order: [['id_pagamento', 'DESC']],
      limit: 20,
      offset: 40,
    });

    await pagamentoRepository.listar({ limite: 10, pagina: 1 });
    expect(modelo.findAndCountAll.mock.calls[1][0].where).toEqual({});
  });

  it('traduz violação de unicidade ao criar e ao atualizar em RegistroDuplicadoError', async () => {
    modelo.create.mockRejectedValue(new UniqueConstraintError({}));
    await expect(
      pagamentoRepository.criar({ id_pedido: 1, id_usuario: 2, metodo_pagamento: 'pix', valor: 10, status: 'PENDENTE' })
    ).rejects.toBeInstanceOf(RegistroDuplicadoError);

    const instancia = { update: jest.fn().mockRejectedValue(new UniqueConstraintError({})) } as unknown as Pagamento;
    await expect(pagamentoRepository.atualizar(instancia, { status: 'PENDENTE' })).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
  });

  it('não esconde outros erros do banco', async () => {
    const falha = new Error('banco fora do ar');
    modelo.create.mockRejectedValue(falha);
    await expect(
      pagamentoRepository.criar({ id_pedido: 1, id_usuario: 2, metodo_pagamento: 'pix', valor: 10, status: 'PENDENTE' })
    ).rejects.toBe(falha);
  });

  it('reivindicarAprovacao e marcarParaReembolso só mudam o que ainda não está APROVADO e dizem se mudaram', async () => {
    modelo.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([0]);

    expect(await pagamentoRepository.reivindicarAprovacao(5, 'mp-9')).toBe(true);
    expect(modelo.update.mock.calls[0][0]).toMatchObject({ status: 'APROVADO', id_pagamento_gateway: 'mp-9' });
    expect(modelo.update.mock.calls[0][1]).toEqual({ where: { id_pagamento: 5, status: { [Op.ne]: 'APROVADO' } } });

    expect(await pagamentoRepository.marcarParaReembolso(5, 'mp-9')).toBe(false);
    expect(modelo.update.mock.calls[1][0]).toEqual({ status: 'REEMBOLSAR', id_pagamento_gateway: 'mp-9' });
  });
});
