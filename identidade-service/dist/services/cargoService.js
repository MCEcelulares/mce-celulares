"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarCargos = listarCargos;
exports.buscarCargo = buscarCargo;
exports.criarCargo = criarCargo;
exports.renomearCargo = renomearCargo;
exports.excluirCargo = excluirCargo;
exports.definirPermissoesDoCargo = definirPermissoesDoCargo;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const rbac_1 = require("../config/rbac");
const incluirPermissoes = [
    { model: models_1.Permissao, as: 'permissoes', attributes: ['nome'], through: { attributes: [] } },
];
function paraResposta(cargo) {
    return {
        id_cargo: cargo.id_cargo,
        nome: cargo.nome,
        protegido: rbac_1.cargosProtegidos.includes(cargo.nome),
        permissoes: (cargo.permissoes ?? []).map((p) => p.nome).sort(),
    };
}
async function obterCargoOuFalhar(id) {
    const cargo = await models_1.Cargo.findByPk(id, { include: incluirPermissoes });
    if (!cargo) {
        throw new errorHandler_1.ErroHttp(404, 'Cargo não existe');
    }
    return cargo;
}
function exigirNaoProtegido(cargo, acao) {
    if (rbac_1.cargosProtegidos.includes(cargo.nome)) {
        throw new errorHandler_1.ErroHttp(409, `O cargo "${cargo.nome}" é do sistema e não pode ${acao}`);
    }
}
async function buscarPermissoesPorNome(nomes) {
    const unicos = [...new Set(nomes)];
    const permissoes = await models_1.Permissao.findAll({ where: { nome: unicos } });
    const inexistentes = unicos.filter((n) => !permissoes.some((p) => p.nome === n));
    if (inexistentes.length > 0) {
        throw new errorHandler_1.ErroHttp(400, `Permissão(ões) inexistente(s): ${inexistentes.join(', ')}`);
    }
    return permissoes;
}
async function listarCargos() {
    const cargos = await models_1.Cargo.findAll({ include: incluirPermissoes, order: [['id_cargo', 'ASC']] });
    return cargos.map(paraResposta);
}
async function buscarCargo(id) {
    return paraResposta(await obterCargoOuFalhar(id));
}
async function criarCargo(dados, criadoPor) {
    const permissoes = dados.permissoes ? await buscarPermissoesPorNome(dados.permissoes) : [];
    let id;
    try {
        const cargo = await database_1.sequelize.transaction(async (transaction) => {
            const novo = await models_1.Cargo.create({ nome: dados.nome }, { transaction });
            if (permissoes.length > 0) {
                await models_1.CargoPermissao.bulkCreate(permissoes.map((p) => ({ id_cargo: novo.id_cargo, id_permissao: p.id_permissao })), { transaction });
            }
            return novo;
        });
        id = cargo.id_cargo;
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe um cargo com esse nome');
        }
        throw err;
    }
    logger_1.logger.info({ id_cargo: id, nome: dados.nome, criadoPor }, 'cargo criado');
    return paraResposta(await obterCargoOuFalhar(id));
}
async function renomearCargo(id, nome, alteradoPor) {
    const cargo = await obterCargoOuFalhar(id);
    exigirNaoProtegido(cargo, 'ser renomeado');
    try {
        await cargo.update({ nome });
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, 'Já existe um cargo com esse nome');
        }
        throw err;
    }
    logger_1.logger.info({ id_cargo: id, nome, alteradoPor }, 'cargo renomeado');
    return paraResposta(cargo);
}
async function excluirCargo(id, excluidoPor) {
    const cargo = await obterCargoOuFalhar(id);
    exigirNaoProtegido(cargo, 'ser excluído');
    const emUso = await models_1.UsuarioCargo.count({ where: { id_cargo: id } });
    if (emUso > 0) {
        throw new errorHandler_1.ErroHttp(409, `O cargo está atribuído a ${emUso} usuário(s). Remova-o deles antes de excluir`);
    }
    await database_1.sequelize.transaction(async (transaction) => {
        await models_1.CargoPermissao.destroy({ where: { id_cargo: id }, transaction });
        await cargo.destroy({ transaction });
    });
    logger_1.logger.info({ id_cargo: id, nome: cargo.nome, excluidoPor }, 'cargo excluído');
}
async function definirPermissoesDoCargo(id, nomes, alteradoPor) {
    const cargo = await obterCargoOuFalhar(id);
    if (cargo.nome === rbac_1.nomeCargoAdmin) {
        throw new errorHandler_1.ErroHttp(409, 'As permissões do cargo "administrador" não podem ser alteradas');
    }
    const permissoes = await buscarPermissoesPorNome(nomes);
    await database_1.sequelize.transaction(async (transaction) => {
        await models_1.CargoPermissao.destroy({ where: { id_cargo: id }, transaction });
        if (permissoes.length > 0) {
            await models_1.CargoPermissao.bulkCreate(permissoes.map((p) => ({ id_cargo: id, id_permissao: p.id_permissao })), { transaction });
        }
    });
    logger_1.logger.info({ id_cargo: id, permissoes: permissoes.map((p) => p.nome), alteradoPor }, 'permissões do cargo atualizadas');
    return paraResposta(await obterCargoOuFalhar(id));
}
