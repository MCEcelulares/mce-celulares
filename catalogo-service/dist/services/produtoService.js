"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarRecentes = exports.listarDestaques = void 0;
exports.listarProdutos = listarProdutos;
exports.buscarProduto = buscarProduto;
exports.criarProduto = criarProduto;
exports.atualizarProduto = atualizarProduto;
exports.inativarProduto = inativarProduto;
exports.ajustarEstoque = ajustarEstoque;
exports.trocarImagem = trocarImagem;
exports.removerImagem = removerImagem;
exports.consultarProdutosInterno = consultarProdutosInterno;
const crypto_1 = require("crypto");
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const like_1 = require("../utils/like");
const cacheService_1 = require("./cacheService");
const imagemService_1 = require("./imagemService");
const incluirRelacionados = [
    { model: models_1.Marca, as: 'marca', attributes: ['id_marca', 'nome'] },
    { model: models_1.Categoria, as: 'categoria', attributes: ['id_categoria', 'nome'] },
];
const ordenacoes = {
    recentes: [['criado_em', 'DESC'], ['id_produto', 'DESC']],
    preco_asc: [['preco', 'ASC'], ['id_produto', 'ASC']],
    preco_desc: [['preco', 'DESC'], ['id_produto', 'ASC']],
};
function paraResposta(produto) {
    return {
        id_produto: produto.id_produto,
        nome: produto.nome,
        descricao: produto.descricao,
        preco: Number(produto.preco),
        estoque: produto.estoque,
        imagem: (0, imagemService_1.urlDaImagem)(produto.imagem),
        destaque: produto.destaque,
        ativo: produto.ativo,
        id_marca: produto.id_marca,
        id_categoria: produto.id_categoria,
        marca: produto.marca ? { id_marca: produto.marca.id_marca, nome: produto.marca.nome } : null,
        categoria: produto.categoria
            ? { id_categoria: produto.categoria.id_categoria, nome: produto.categoria.nome }
            : null,
        criado_em: produto.criado_em,
    };
}
async function obterProdutoOuFalhar(id) {
    const produto = await models_1.Produto.findByPk(id, { include: incluirRelacionados });
    if (!produto) {
        throw new errorHandler_1.ErroHttp(404, 'Produto não existe');
    }
    return produto;
}
async function garantirMarcaECategoria(idMarca, idCategoria) {
    if (idMarca !== undefined && !(await models_1.Marca.findByPk(idMarca))) {
        throw new errorHandler_1.ErroHttp(400, 'Marca não existe');
    }
    if (idCategoria !== undefined && !(await models_1.Categoria.findByPk(idCategoria))) {
        throw new errorHandler_1.ErroHttp(400, 'Categoria não existe');
    }
}
async function listarProdutos(filtros, verInativos) {
    const { incluirInativos: _ignorado, ...criterios } = filtros;
    const carregar = async () => {
        const condicoes = [];
        if (!verInativos)
            condicoes.push({ ativo: true });
        if (criterios.categoria)
            condicoes.push({ id_categoria: criterios.categoria });
        if (criterios.marca)
            condicoes.push({ id_marca: criterios.marca });
        if (criterios.precoMin !== undefined)
            condicoes.push({ preco: { [sequelize_1.Op.gte]: criterios.precoMin } });
        if (criterios.precoMax !== undefined)
            condicoes.push({ preco: { [sequelize_1.Op.lte]: criterios.precoMax } });
        if (criterios.disponivel)
            condicoes.push({ estoque: { [sequelize_1.Op.gt]: 0 } });
        const palavras = (criterios.busca ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
        for (const palavra of palavras) {
            condicoes.push({ nome: { [sequelize_1.Op.like]: `%${(0, like_1.escaparLike)(palavra)}%` } });
        }
        const { rows, count } = await models_1.Produto.findAndCountAll({
            where: { [sequelize_1.Op.and]: condicoes },
            include: incluirRelacionados,
            order: ordenacoes[criterios.ordenar],
            limit: criterios.limite,
            offset: (criterios.pagina - 1) * criterios.limite,
        });
        return {
            dados: rows.map(paraResposta),
            paginacao: {
                pagina: criterios.pagina,
                limite: criterios.limite,
                total: count,
                totalPaginas: Math.ceil(count / criterios.limite),
            },
        };
    };
    if (verInativos)
        return carregar();
    const chave = (0, crypto_1.createHash)('sha1').update(JSON.stringify(criterios)).digest('hex');
    return (0, cacheService_1.obterOuCarregar)(`produtos:lista:${chave}`, carregar);
}
async function vitrine(chave, where, limite) {
    return (0, cacheService_1.obterOuCarregar)(`produtos:${chave}:${limite}`, async () => {
        const produtos = await models_1.Produto.findAll({
            where,
            include: incluirRelacionados,
            order: ordenacoes.recentes,
            limit: limite,
        });
        return produtos.map(paraResposta);
    });
}
const listarDestaques = (limite) => vitrine('destaque', { ativo: true, destaque: true }, limite);
exports.listarDestaques = listarDestaques;
const listarRecentes = (limite) => vitrine('recentes', { ativo: true }, limite);
exports.listarRecentes = listarRecentes;
async function buscarProduto(id, verInativos) {
    if (verInativos)
        return paraResposta(await obterProdutoOuFalhar(id));
    return (0, cacheService_1.obterOuCarregar)(`produtos:${id}`, async () => {
        const produto = await obterProdutoOuFalhar(id);
        if (!produto.ativo) {
            throw new errorHandler_1.ErroHttp(404, 'Produto não existe');
        }
        return paraResposta(produto);
    });
}
async function criarProduto(dados, criadoPor) {
    await garantirMarcaECategoria(dados.id_marca, dados.id_categoria);
    const produto = await models_1.Produto.create(dados);
    await (0, cacheService_1.invalidarCatalogo)();
    (0, metricas_1.registrarEvento)('produto_criado');
    logger_1.logger.info({ id_produto: produto.id_produto, nome: produto.nome, criadoPor }, 'produto criado');
    return paraResposta(await obterProdutoOuFalhar(produto.id_produto));
}
async function atualizarProduto(id, dados, alteradoPor) {
    const produto = await obterProdutoOuFalhar(id);
    await garantirMarcaECategoria(dados.id_marca, dados.id_categoria);
    await produto.update(dados);
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_produto: id, campos: Object.keys(dados), alteradoPor }, 'produto atualizado');
    return paraResposta(await obterProdutoOuFalhar(id));
}
// Produto nunca é apagado: pedidos antigos guardam snapshot, e o histórico do estoque aponta para ele (RF12 permite inativar).
async function inativarProduto(id, inativadoPor) {
    const produto = await obterProdutoOuFalhar(id);
    if (produto.ativo) {
        await produto.update({ ativo: false });
        await (0, cacheService_1.invalidarCatalogo)();
        (0, metricas_1.registrarEvento)('produto_inativado');
    }
    logger_1.logger.info({ id_produto: id, inativadoPor }, 'produto inativado');
}
async function ajustarEstoque(id, ajuste, alteradoPor) {
    await obterProdutoOuFalhar(id);
    const [alterados] = await models_1.Produto.update({ estoque: (0, sequelize_1.literal)(`estoque + ${Math.trunc(ajuste)}`) }, { where: { id_produto: id, ...(ajuste < 0 ? { estoque: { [sequelize_1.Op.gte]: -ajuste } } : {}) } });
    if (alterados === 0) {
        throw new errorHandler_1.ErroHttp(409, 'Estoque insuficiente para essa baixa');
    }
    await (0, cacheService_1.invalidarCatalogo)();
    (0, metricas_1.registrarEvento)('estoque_ajustado');
    logger_1.logger.info({ id_produto: id, ajuste, alteradoPor }, 'estoque ajustado');
    return paraResposta(await obterProdutoOuFalhar(id));
}
async function trocarImagem(id, arquivo, alteradoPor) {
    const produto = await obterProdutoOuFalhar(id);
    const anterior = produto.imagem;
    const nova = await (0, imagemService_1.gravarImagem)(arquivo);
    try {
        await produto.update({ imagem: nova });
    }
    catch (err) {
        await (0, imagemService_1.apagarImagem)(nova);
        throw err;
    }
    await (0, imagemService_1.apagarImagem)(anterior);
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_produto: id, imagem: nova, alteradoPor }, 'imagem do produto atualizada');
    return paraResposta(await obterProdutoOuFalhar(id));
}
async function removerImagem(id, removidoPor) {
    const produto = await obterProdutoOuFalhar(id);
    if (!produto.imagem)
        return;
    const anterior = produto.imagem;
    await produto.update({ imagem: null });
    await (0, imagemService_1.apagarImagem)(anterior);
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_produto: id, removidoPor }, 'imagem do produto removida');
}
async function consultarProdutosInterno(ids) {
    const produtos = await models_1.Produto.findAll({ where: { id_produto: [...new Set(ids)] }, order: [['id_produto', 'ASC']] });
    return produtos.map((p) => ({
        id_produto: p.id_produto,
        nome: p.nome,
        preco: Number(p.preco),
        estoque: p.estoque,
        ativo: p.ativo,
        imagem: (0, imagemService_1.urlDaImagem)(p.imagem),
    }));
}
