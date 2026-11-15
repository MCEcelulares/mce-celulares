import { Op } from 'sequelize';
import { sequelize } from '../src/config/database';
import { Categoria, Marca, Produto, ReservaEstoque } from '../src/models';
import * as categoriaRepository from '../src/repositories/categoriaRepository';
import * as marcaRepository from '../src/repositories/marcaRepository';
import * as produtoRepository from '../src/repositories/produtoRepository';
import * as reservaEstoqueRepository from '../src/repositories/reservaEstoqueRepository';
import { RegistroDuplicadoError } from '../src/repositories/erros';
import { comTransacao } from '../src/repositories/transacao';
import { statusReserva } from '../src/config/catalogo';

const run = Date.now().toString(36);
const tag = (nome: string) => `repo-${run}-${nome}`;
let proximoPedido = Number(String(Date.now()).slice(-8)) * 10 + 5;
const novoPedido = () => ++proximoPedido;

let categoria: Categoria;
let marca: Marca;

const criarProduto = (nome: string, extra: Record<string, unknown> = {}) =>
  produtoRepository.criar({
    nome: tag(nome),
    preco: 100,
    estoque: 10,
    id_marca: marca.id_marca,
    id_categoria: categoria.id_categoria,
    ...extra,
  });

const palavra = `xb${run}`; // única por execução, para a busca não pegar sobras de outras execuções
const criteriosBase = { ordenar: 'recentes' as const, limite: 50, pagina: 1 };

beforeAll(async () => {
  categoria = await categoriaRepository.criar({ nome: tag('categoria') });
  marca = await marcaRepository.criar({ nome: tag('marca') });
});

afterAll(async () => {
  const produtos = await Produto.findAll({ where: { nome: { [Op.like]: `repo-${run}%` } } });
  const ids = produtos.map((p) => p.id_produto);
  await ReservaEstoque.destroy({ where: { id_produto: ids } });
  await Produto.destroy({ where: { id_produto: ids } });
  await Categoria.destroy({ where: { nome: { [Op.like]: `repo-${run}%` } } });
  await Marca.destroy({ where: { nome: { [Op.like]: `repo-${run}%` } } });
  await sequelize.close();
});

describe('categoriaRepository e marcaRepository', () => {
  it('nome repetido vira RegistroDuplicadoError ao criar e ao atualizar', async () => {
    await expect(categoriaRepository.criar({ nome: tag('categoria') })).rejects.toBeInstanceOf(RegistroDuplicadoError);
    await expect(marcaRepository.criar({ nome: tag('marca') })).rejects.toBeInstanceOf(RegistroDuplicadoError);

    const outraCategoria = await categoriaRepository.criar({ nome: tag('categoria-b') });
    await expect(categoriaRepository.atualizar(outraCategoria, { nome: tag('categoria') })).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
    const outraMarca = await marcaRepository.criar({ nome: tag('marca-b') });
    await expect(marcaRepository.atualizar(outraMarca, { nome: tag('marca') })).rejects.toBeInstanceOf(
      RegistroDuplicadoError
    );
  });

  it('lista só as ativas, ou todas quando pedido, em ordem de nome', async () => {
    const inativa = await categoriaRepository.criar({ nome: tag('categoria-inativa'), ativo: false });

    const ativas = (await categoriaRepository.listar(false)).map((c) => c.id_categoria);
    const todas = (await categoriaRepository.listar(true)).map((c) => c.id_categoria);
    expect(ativas).toContain(categoria.id_categoria);
    expect(ativas).not.toContain(inativa.id_categoria);
    expect(todas).toContain(inativa.id_categoria);

    const nomes = (await marcaRepository.listar(true)).map((m) => m.nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  });

  it('busca, atualiza e exclui', async () => {
    const nova = await marcaRepository.criar({ nome: tag('marca-c') });
    expect((await marcaRepository.buscarPorId(nova.id_marca))?.nome).toBe(tag('marca-c'));

    await marcaRepository.atualizar(nova, { ativo: false });
    expect((await marcaRepository.buscarPorId(nova.id_marca))?.ativo).toBe(false);

    await marcaRepository.excluir(nova);
    expect(await marcaRepository.buscarPorId(nova.id_marca)).toBeNull();
  });
});

describe('produtoRepository', () => {
  it('conta produtos por categoria e por marca', async () => {
    const cat = await categoriaRepository.criar({ nome: tag('categoria-contagem') });
    const mar = await marcaRepository.criar({ nome: tag('marca-contagem') });
    await criarProduto('contado-1', { id_categoria: cat.id_categoria, id_marca: mar.id_marca });
    await criarProduto('contado-2', { id_categoria: cat.id_categoria, id_marca: mar.id_marca });

    expect(await produtoRepository.contarPorCategoria(cat.id_categoria)).toBe(2);
    expect(await produtoRepository.contarPorMarca(mar.id_marca)).toBe(2);
    expect(await produtoRepository.contarPorCategoria(999999999)).toBe(0);
  });

  it('ajustarEstoque soma, subtrai e recusa a baixa que deixaria o estoque negativo', async () => {
    const p = await criarProduto('ajuste', { estoque: 5 });

    expect(await produtoRepository.ajustarEstoque(p.id_produto, 3)).toBe(true);
    expect((await produtoRepository.buscarPorId(p.id_produto))?.estoque).toBe(8);

    expect(await produtoRepository.ajustarEstoque(p.id_produto, -8)).toBe(true);
    expect((await produtoRepository.buscarPorId(p.id_produto))?.estoque).toBe(0);

    expect(await produtoRepository.ajustarEstoque(p.id_produto, -1)).toBe(false);
    expect((await produtoRepository.buscarPorId(p.id_produto))?.estoque).toBe(0);
  });

  it('reporEstoque vale para produto inativo e diz false se o produto não existe', async () => {
    const inativo = await criarProduto('reposicao-inativo', { estoque: 1, ativo: false });
    expect(await produtoRepository.reporEstoque(inativo.id_produto, 4)).toBe(true);
    expect((await produtoRepository.buscarPorId(inativo.id_produto))?.estoque).toBe(5);
    expect(await produtoRepository.reporEstoque(999999999, 1)).toBe(false);
  });

  it('lista com filtros: busca por palavras, faixa de preço, disponibilidade, ordenação e paginação', async () => {
    const barato = await criarProduto(`${palavra} azul`, { preco: 50, estoque: 3 });
    const caro = await criarProduto(`${palavra} verde`, { preco: 500, estoque: 0 });
    await criarProduto(`${palavra} inativo`, { preco: 70, ativo: false });

    const busca = await produtoRepository.listar({ ...criteriosBase, busca: palavra }, false);
    expect(busca.registros.map((p) => p.id_produto).sort()).toEqual([barato.id_produto, caro.id_produto].sort());

    const duasPalavras = await produtoRepository.listar({ ...criteriosBase, busca: `${palavra} verde` }, false);
    expect(duasPalavras.registros.map((p) => p.id_produto)).toEqual([caro.id_produto]);

    const faixa = await produtoRepository.listar({ ...criteriosBase, busca: palavra, precoMin: 100 }, false);
    expect(faixa.registros.map((p) => p.id_produto)).toEqual([caro.id_produto]);

    const disponiveis = await produtoRepository.listar({ ...criteriosBase, busca: palavra, disponivel: true }, false);
    expect(disponiveis.registros.map((p) => p.id_produto)).toEqual([barato.id_produto]);

    const comInativos = await produtoRepository.listar({ ...criteriosBase, busca: palavra }, true);
    expect(comInativos.total).toBe(3);

    const porPreco = await produtoRepository.listar({ ...criteriosBase, busca: palavra, ordenar: 'preco_desc' }, false);
    expect(porPreco.registros.map((p) => p.id_produto)).toEqual([caro.id_produto, barato.id_produto]);

    const pagina2 = await produtoRepository.listar(
      { ...criteriosBase, busca: palavra, ordenar: 'preco_asc', limite: 1, pagina: 2 },
      false
    );
    expect(pagina2.total).toBe(2);
    expect(pagina2.registros.map((p) => p.id_produto)).toEqual([caro.id_produto]);
  });

  it('trata % e _ na busca como texto comum (sem curinga)', async () => {
    await criarProduto('coringa 100% teste');
    const comPorcento = await produtoRepository.listar({ ...criteriosBase, busca: '100%' }, false);
    expect(comPorcento.registros.some((p) => p.nome === tag('coringa 100% teste'))).toBe(true);
    const soUnderline = await produtoRepository.listar({ ...criteriosBase, busca: '_____________' }, false);
    expect(soUnderline.total).toBe(0);
  });

  it('consulta por ids sem repetir e em ordem, inclusive inativos', async () => {
    const a = await criarProduto('ids-a');
    const b = await criarProduto('ids-b', { ativo: false });
    const r = await produtoRepository.consultarPorIds([b.id_produto, a.id_produto, a.id_produto, 999999999]);
    expect(r.map((p) => p.id_produto)).toEqual([a.id_produto, b.id_produto]);
  });

  it('carrega o produto com marca e categoria', async () => {
    const p = await criarProduto('relacionados');
    const completo = await produtoRepository.buscarPorIdComRelacionados(p.id_produto);
    expect(completo?.marca?.nome).toBe(tag('marca'));
    expect(completo?.categoria?.nome).toBe(tag('categoria'));
  });

  it('as contagens do painel somam ativos, sem estoque, destaques e o valor em estoque', async () => {
    const antes = await produtoRepository.contagens();
    await criarProduto('painel-destaque', { preco: 10, estoque: 2, destaque: true });
    await criarProduto('painel-zerado', { preco: 10, estoque: 0 });
    await criarProduto('painel-inativo', { preco: 10, estoque: 9, ativo: false });

    const depois = await produtoRepository.contagens();
    expect(depois.total - antes.total).toBe(3);
    expect(depois.ativos - antes.ativos).toBe(2);
    expect(depois.semEstoque - antes.semEstoque).toBe(1);
    expect(depois.emDestaque - antes.emDestaque).toBe(1);
    expect(depois.valorEmEstoque - antes.valorEmEstoque).toBeCloseTo(20, 2);
  });
});

describe('reserva de estoque (operações dentro da transação)', () => {
  it('baixarSeHouver só desconta com estoque suficiente e com o produto ativo', async () => {
    const p = await criarProduto('baixa', { estoque: 3 });
    const inativo = await criarProduto('baixa-inativo', { estoque: 3, ativo: false });

    const resultados = await comTransacao(async (t) => [
      await produtoRepository.baixarSeHouver(p.id_produto, 2, t),
      await produtoRepository.baixarSeHouver(p.id_produto, 2, t),
      await produtoRepository.baixarSeHouver(inativo.id_produto, 1, t),
    ]);

    expect(resultados).toEqual([true, false, false]);
    expect((await produtoRepository.buscarPorId(p.id_produto))?.estoque).toBe(1);
    expect((await produtoRepository.buscarPorId(inativo.id_produto))?.estoque).toBe(3);
  });

  it('desfaz tudo se a transação falhar', async () => {
    const p = await criarProduto('rollback', { estoque: 5 });
    await expect(
      comTransacao(async (t) => {
        await produtoRepository.baixarSeHouver(p.id_produto, 5, t);
        throw new Error('falha no meio');
      })
    ).rejects.toThrow('falha no meio');
    expect((await produtoRepository.buscarPorId(p.id_produto))?.estoque).toBe(5);
  });

  it('trava os produtos em ordem de id, cria a reserva do pedido e devolve a quantidade', async () => {
    const a = await criarProduto('reserva-a', { estoque: 4 });
    const b = await criarProduto('reserva-b', { estoque: 4 });
    const idPedido = novoPedido();

    const reservas = await comTransacao(async (t) => {
      const travados = await produtoRepository.travarPorIds([b.id_produto, a.id_produto], t);
      expect(travados.map((p) => p.id_produto)).toEqual([a.id_produto, b.id_produto]);
      return reservaEstoqueRepository.criarDoPedido(
        idPedido,
        [
          { id_produto: a.id_produto, quantidade: 1 },
          { id_produto: b.id_produto, quantidade: 2 },
        ],
        t
      );
    });
    expect(reservas).toHaveLength(2);

    const lidas = await reservaEstoqueRepository.buscarPorPedido(idPedido);
    expect(lidas.map((r) => r.status)).toEqual([statusReserva.ativa, statusReserva.ativa]);

    await comTransacao(async (t) => {
      const travadas = await reservaEstoqueRepository.buscarPorPedidoTravando(idPedido, t);
      for (const r of travadas) {
        await produtoRepository.devolverQuantidade(r.id_produto, r.quantidade, t);
        await reservaEstoqueRepository.marcarDevolvida(r, t);
      }
    });

    expect((await produtoRepository.buscarPorId(a.id_produto))?.estoque).toBe(5);
    expect((await produtoRepository.buscarPorId(b.id_produto))?.estoque).toBe(6);
    const depois = await reservaEstoqueRepository.buscarPorPedido(idPedido);
    expect(depois.every((r) => r.status === statusReserva.devolvida)).toBe(true);
  });

  it('uma segunda reserva do mesmo pedido e produto vira RegistroDuplicadoError', async () => {
    const p = await criarProduto('reserva-duplicada');
    const idPedido = novoPedido();
    const reservar = () =>
      comTransacao((t) =>
        reservaEstoqueRepository.criarDoPedido(idPedido, [{ id_produto: p.id_produto, quantidade: 1 }], t)
      );

    await reservar();
    await expect(reservar()).rejects.toBeInstanceOf(RegistroDuplicadoError);
  });
});
