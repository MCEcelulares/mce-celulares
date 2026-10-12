"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarEnderecos = listarEnderecos;
exports.buscarEndereco = buscarEndereco;
exports.criarEndereco = criarEndereco;
exports.atualizarEndereco = atualizarEndereco;
exports.marcarEnderecoPrincipal = marcarEnderecoPrincipal;
exports.removerEndereco = removerEndereco;
const models_1 = require("../models");
const database_1 = require("../config/database");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
async function garantirUsuario(idUsuario) {
    const usuario = await models_1.Usuario.findByPk(idUsuario);
    if (!usuario) {
        throw new errorHandler_1.ErroHttp(404, 'Usuário não existe');
    }
}
async function obterEnderecoOuFalhar(idUsuario, idEndereco) {
    const endereco = await models_1.Endereco.findOne({ where: { id_endereco: idEndereco, id_usuario: idUsuario } });
    if (!endereco) {
        throw new errorHandler_1.ErroHttp(404, 'Endereço não encontrado para esse usuário');
    }
    return endereco;
}
async function listarEnderecos(idUsuario) {
    await garantirUsuario(idUsuario);
    return models_1.Endereco.findAll({
        where: { id_usuario: idUsuario },
        order: [['principal', 'DESC'], ['id_endereco', 'ASC']],
    });
}
async function buscarEndereco(idUsuario, idEndereco) {
    await garantirUsuario(idUsuario);
    return obterEnderecoOuFalhar(idUsuario, idEndereco);
}
async function criarEndereco(idUsuario, dados) {
    await garantirUsuario(idUsuario);
    return database_1.sequelize.transaction(async (transaction) => {
        const total = await models_1.Endereco.count({ where: { id_usuario: idUsuario }, transaction });
        const principal = dados.principal ?? total === 0;
        if (principal) {
            await models_1.Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
        }
        const endereco = await models_1.Endereco.create({ ...dados, id_usuario: idUsuario, principal }, { transaction });
        logger_1.logger.info({ id_usuario: idUsuario, id_endereco: endereco.id_endereco }, 'endereço criado');
        return endereco;
    });
}
async function atualizarEndereco(idUsuario, idEndereco, dados) {
    const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);
    if (dados.principal === false && endereco.principal) {
        throw new errorHandler_1.ErroHttp(400, 'Para trocar o endereço principal, marque outro endereço como principal');
    }
    return database_1.sequelize.transaction(async (transaction) => {
        if (dados.principal === true) {
            await models_1.Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
        }
        await endereco.update(dados, { transaction });
        logger_1.logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço atualizado');
        return endereco;
    });
}
async function marcarEnderecoPrincipal(idUsuario, idEndereco) {
    const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);
    return database_1.sequelize.transaction(async (transaction) => {
        await models_1.Endereco.update({ principal: false }, { where: { id_usuario: idUsuario }, transaction });
        await endereco.update({ principal: true }, { transaction });
        logger_1.logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço principal definido');
        return endereco;
    });
}
async function removerEndereco(idUsuario, idEndereco) {
    const endereco = await obterEnderecoOuFalhar(idUsuario, idEndereco);
    await database_1.sequelize.transaction(async (transaction) => {
        const eraPrincipal = endereco.principal;
        await endereco.destroy({ transaction });
        if (eraPrincipal) {
            const proximo = await models_1.Endereco.findOne({
                where: { id_usuario: idUsuario },
                order: [['id_endereco', 'ASC']],
                transaction,
            });
            if (proximo)
                await proximo.update({ principal: true }, { transaction });
        }
    });
    logger_1.logger.info({ id_usuario: idUsuario, id_endereco: idEndereco }, 'endereço removido');
}
