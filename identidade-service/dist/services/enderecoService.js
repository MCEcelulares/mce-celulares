"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarEnderecos = listarEnderecos;
exports.criarEndereco = criarEndereco;
exports.marcarEnderecoPrincipal = marcarEnderecoPrincipal;
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
async function listarEnderecos(idUsuario) {
    const usuario = await models_1.Usuario.findByPk(idUsuario);
    if (!usuario) {
        throw new errorHandler_1.ErroHttp(404, 'Usuário não existe');
    }
    return models_1.Endereco.findAll({ where: { id_usuario: idUsuario } });
}
async function criarEndereco(idUsuario, dados) {
    const usuario = await models_1.Usuario.findByPk(idUsuario);
    if (!usuario) {
        throw new errorHandler_1.ErroHttp(404, 'Usuário não existe');
    }
    const totalExistente = await models_1.Endereco.count({ where: { id_usuario: idUsuario } });
    const principal = dados.principal ?? totalExistente === 0;
    if (principal) {
        await models_1.Endereco.update({ principal: false }, { where: { id_usuario: idUsuario } });
    }
    return models_1.Endereco.create({ ...dados, id_usuario: idUsuario, principal });
}
async function marcarEnderecoPrincipal(idUsuario, idEndereco) {
    const endereco = await models_1.Endereco.findOne({ where: { id_endereco: idEndereco, id_usuario: idUsuario } });
    if (!endereco) {
        throw new errorHandler_1.ErroHttp(404, 'Endereço não encontrado para esse usuário');
    }
    await models_1.Endereco.update({ principal: false }, { where: { id_usuario: idUsuario } });
    endereco.principal = true;
    await endereco.save();
    return endereco;
}
