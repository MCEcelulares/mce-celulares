"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarPermissoes = listarPermissoes;
exports.buscarPermissao = buscarPermissao;
exports.criarPermissao = criarPermissao;
exports.renomearPermissao = renomearPermissao;
exports.excluirPermissao = excluirPermissao;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const rbac_1 = require("../config/rbac");
const ehDoSistema = (nome) => rbac_1.permissoesDoSistema.includes(nome);
async function obterPermissaoOuFalhar(id) {
    const permissao = await models_1.Permissao.findByPk(id);
    if (!permissao) {
        throw new errorHandler_1.ErroHttp(404, 'Permissão não existe');
    }
    return permissao;
}
async function exigirEditavel(permissao, acao) {
    if (ehDoSistema(permissao.nome)) {
        throw new errorHandler_1.ErroHttp(409, `A permissão "${permissao.nome}" é do sistema e não pode ${acao}`);
    }
    const cargos = await models_1.Cargo.findAll({
        include: [{ model: models_1.Permissao, as: 'permissoes', where: { id_permissao: permissao.id_permissao }, required: true }],
    });
    const dependentes = cargos.filter((c) => c.nome !== rbac_1.nomeCargoAdmin).map((c) => c.nome);
    if (dependentes.length > 0) {
        throw new errorHandler_1.ErroHttp(409, `A permissão está em uso pelo(s) cargo(s): ${dependentes.join(', ')}`);
    }
}
function paraResposta(permissao) {
    return { id_permissao: permissao.id_permissao, nome: permissao.nome, do_sistema: ehDoSistema(permissao.nome) };
}
async function listarPermissoes() {
    const permissoes = await models_1.Permissao.findAll({ order: [['nome', 'ASC']] });
    return permissoes.map(paraResposta);
}
async function buscarPermissao(id) {
    return paraResposta(await obterPermissaoOuFalhar(id));
}
async function criarPermissao(nome, criadoPor) {
    try {
        const permissao = await database_1.sequelize.transaction(async (transaction) => {
            const nova = await models_1.Permissao.create({ nome }, { transaction });
            const admin = await models_1.Cargo.findOne({ where: { nome: rbac_1.nomeCargoAdmin }, transaction });
            if (admin) {
                await models_1.CargoPermissao.create({ id_cargo: admin.id_cargo, id_permissao: nova.id_permissao }, { transaction });
            }
            return nova;
        });
        logger_1.logger.info({ id_permissao: permissao.id_permissao, nome, criadoPor }, 'permissão criada');
        return paraResposta(permissao);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma permissão com esse nome');
        }
        throw err;
    }
}
async function renomearPermissao(id, nome, alteradoPor) {
    const permissao = await obterPermissaoOuFalhar(id);
    await exigirEditavel(permissao, 'ser renomeada');
    try {
        await permissao.update({ nome });
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe uma permissão com esse nome');
        }
        throw err;
    }
    logger_1.logger.info({ id_permissao: id, nome, alteradoPor }, 'permissão renomeada');
    return paraResposta(permissao);
}
async function excluirPermissao(id, excluidoPor) {
    const permissao = await obterPermissaoOuFalhar(id);
    await exigirEditavel(permissao, 'ser excluída');
    await database_1.sequelize.transaction(async (transaction) => {
        await models_1.CargoPermissao.destroy({ where: { id_permissao: id }, transaction });
        await permissao.destroy({ transaction });
    });
    logger_1.logger.info({ id_permissao: id, nome: permissao.nome, excluidoPor }, 'permissão excluída');
}
