"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.loginGoogle = loginGoogle;
const bcrypt_1 = __importDefault(require("bcrypt"));
const google_auth_library_1 = require("google-auth-library");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const jwt_1 = require("../utils/jwt");
const usuarioService_1 = require("./usuarioService");
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
async function login(dados) {
    const usuario = await models_1.Usuario.findOne({ where: { email: dados.email } });
    if (!usuario || !usuario.senha) {
        throw new errorHandler_1.ErroHttp(401, 'Credenciais inválidas');
    }
    const senhaConfere = await bcrypt_1.default.compare(dados.senha, usuario.senha);
    if (!senhaConfere) {
        throw new errorHandler_1.ErroHttp(401, 'Credenciais inválidas');
    }
    const token = (0, jwt_1.assinarToken)({
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        admin: usuario.admin,
    });
    return { token, usuario: (0, usuarioService_1.paraRespostaPublica)(usuario) };
}
async function loginGoogle(idToken) {
    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
        throw new errorHandler_1.ErroHttp(401, 'Token do Google inválido');
    }
    let usuario = await models_1.Usuario.findOne({ where: { googleId: payload.sub } });
    if (!usuario) {
        usuario = await models_1.Usuario.create({
            nome: payload.name ?? payload.email,
            email: payload.email,
            provedor: 'google',
            googleId: payload.sub,
            email_verificado: payload.email_verified ?? false,
        });
    }
    const token = (0, jwt_1.assinarToken)({
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        admin: usuario.admin,
    });
    return { token, usuario: (0, usuarioService_1.paraRespostaPublica)(usuario) };
}
