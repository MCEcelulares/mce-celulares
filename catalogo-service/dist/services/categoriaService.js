"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarCategorias = listarCategorias;
exports.buscarCategoria = buscarCategoria;
exports.criarCategoria = criarCategoria;
exports.atualizarCategoria = atualizarCategoria;
exports.excluirCategoria = excluirCategoria;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const cacheService_1 = require("./cacheService");
function paraResposta(categoria) {
    return {
        id_categoria: categoria.id_categoria,
        nome: categoria.nome,
        icone: categoria.icone,
        ativo: categoria.ativo,
    };
}
async function obterCategoriaOuFalhar(id) {
    const categoria = await models_1.Categoria.findByPk(id);
    if (!categoria) {
        throw new errorHandler_1.ErroHttp(404, 'Categoria não existe');
    }
    return categoria;
}
async function listarCategorias(verInativos) {
    const carregar = async () => {
        const categorias = await models_1.Categoria.findAll({
            where: verInativos ? {} : { ativo: true },
            order: [['nome', 'ASC']],
        });
        return categorias.map(paraResposta);
    };
    return verInativos ? carregar() : (0, cacheService_1.obterOuCarregar)('categorias:lista', carregar);
}
async function buscarCategoria(id, verInativos) {
    const categoria = await obterCategoriaOuFalhar(id);
    if (!categoria.ativo && !verInativos) {
        throw new errorHandler_1.ErroHttp(404, 'Categoria não existe');
    }
    return paraResposta(categoria);
}
async function criarCategoria(dados, criadoPor) {
    try {
        const categoria = await models_1.Categoria.create(dados);
        await (0, cacheService_1.invalidarCatalogo)();
        (0, metricas_1.registrarEvento)('categoria_criada');
        logger_1.logger.info({ id_categoria: categoria.id_categoria, nome: categoria.nome, criadoPor }, 'categoria criada');
        return paraResposta(categoria);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma categoria com esse nome');
        }
        throw err;
    }
}
async function atualizarCategoria(id, dados, alteradoPor) {
    const categoria = await obterCategoriaOuFalhar(id);
    try {
        await categoria.update(dados);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma categoria com esse nome');
        }
        throw err;
    }
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_categoria: id, alteradoPor }, 'categoria atualizada');
    return paraResposta(categoria);
}
async function excluirCategoria(id, excluidoPor) {
    const categoria = await obterCategoriaOuFalhar(id);
    const emUso = await models_1.Produto.count({ where: { id_categoria: id } });
    if (emUso > 0) {
        throw new errorHandler_1.ErroHttp(409, `A categoria possui ${emUso} produto(s). Mova os produtos ou inative a categoria em vez de excluir`);
    }
    await categoria.destroy();
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_categoria: id, nome: categoria.nome, excluidoPor }, 'categoria excluída');
}
