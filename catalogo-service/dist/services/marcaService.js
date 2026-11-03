"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarMarcas = listarMarcas;
exports.buscarMarca = buscarMarca;
exports.criarMarca = criarMarca;
exports.atualizarMarca = atualizarMarca;
exports.excluirMarca = excluirMarca;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const cacheService_1 = require("./cacheService");
function paraResposta(marca) {
    return { id_marca: marca.id_marca, nome: marca.nome, ativo: marca.ativo };
}
async function obterMarcaOuFalhar(id) {
    const marca = await models_1.Marca.findByPk(id);
    if (!marca) {
        throw new errorHandler_1.ErroHttp(404, 'Marca não existe');
    }
    return marca;
}
async function listarMarcas(verInativos) {
    const carregar = async () => {
        const marcas = await models_1.Marca.findAll({
            where: verInativos ? {} : { ativo: true },
            order: [['nome', 'ASC']],
        });
        return marcas.map(paraResposta);
    };
    return verInativos ? carregar() : (0, cacheService_1.obterOuCarregar)('marcas:lista', carregar);
}
async function buscarMarca(id, verInativos) {
    const marca = await obterMarcaOuFalhar(id);
    if (!marca.ativo && !verInativos) {
        throw new errorHandler_1.ErroHttp(404, 'Marca não existe');
    }
    return paraResposta(marca);
}
async function criarMarca(dados, criadoPor) {
    try {
        const marca = await models_1.Marca.create(dados);
        await (0, cacheService_1.invalidarCatalogo)();
        (0, metricas_1.registrarEvento)('marca_criada');
        logger_1.logger.info({ id_marca: marca.id_marca, nome: marca.nome, criadoPor }, 'marca criada');
        return paraResposta(marca);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma marca com esse nome');
        }
        throw err;
    }
}
async function atualizarMarca(id, dados, alteradoPor) {
    const marca = await obterMarcaOuFalhar(id);
    try {
        await marca.update(dados);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma marca com esse nome');
        }
        throw err;
    }
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_marca: id, alteradoPor }, 'marca atualizada');
    return paraResposta(marca);
}
async function excluirMarca(id, excluidoPor) {
    const marca = await obterMarcaOuFalhar(id);
    const emUso = await models_1.Produto.count({ where: { id_marca: id } });
    if (emUso > 0) {
        throw new errorHandler_1.ErroHttp(409, `A marca possui ${emUso} produto(s). Mova os produtos ou inative a marca em vez de excluir`);
    }
    await marca.destroy();
    await (0, cacheService_1.invalidarCatalogo)();
    logger_1.logger.info({ id_marca: id, nome: marca.nome, excluidoPor }, 'marca excluída');
}
