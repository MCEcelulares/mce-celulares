"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarUsuario = criarUsuario;
exports.buscarUsuarioPorId = buscarUsuarioPorId;
exports.paraRespostaPublica = paraRespostaPublica;
const bcrypt_1 = __importDefault(require("bcrypt"));
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
async function criarUsuario(dados) {
    const jaExiste = await models_1.Usuario.findOne({ where: { email: dados.email } });
    if (jaExiste) {
        throw new errorHandler_1.ErroHttp(409, 'E-mail já cadastrado');
    }
    const senhaHash = await bcrypt_1.default.hash(dados.senha, 10);
    const usuario = await models_1.Usuario.create({
        nome: dados.nome,
        email: dados.email,
        senha: senhaHash,
        cpf: dados.cpf,
        telefone: dados.telefone,
    });
    const cargoCliente = await models_1.Cargo.findOne({ where: { nome: 'cliente' } });
    if (cargoCliente) {
        await usuario.addCargo(cargoCliente);
    }
    return paraRespostaPublica(usuario);
}
async function buscarUsuarioPorId(id) {
    const usuario = await models_1.Usuario.findByPk(id);
    if (!usuario) {
        throw new errorHandler_1.ErroHttp(404, 'Usuário não existe');
    }
    return paraRespostaPublica(usuario);
}
function paraRespostaPublica(usuario) {
    const { senha, ...resto } = usuario.toJSON();
    return resto;
}
