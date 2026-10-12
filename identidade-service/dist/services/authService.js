"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.loginGoogle = loginGoogle;
exports.renovarSessao = renovarSessao;
exports.encerrarSessao = encerrarSessao;
exports.encerrarTodasAsSessoes = encerrarTodasAsSessoes;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const jwt_1 = require("../utils/jwt");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const rbac_1 = require("../config/rbac");
const usuarioService_1 = require("./usuarioService");
const rbacService_1 = require("./rbacService");
const sessaoService_1 = require("./sessaoService");
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
async function iniciarSessao(usuario) {
    if (!usuario.ativo) {
        logger_1.logger.warn({ id_usuario: usuario.id_usuario }, 'sessão negada: conta inativa');
        throw new errorHandler_1.ErroHttp(403, 'Conta inativa');
    }
    const acesso = await (0, rbacService_1.obterAcesso)(usuario.id_usuario);
    const token = (0, jwt_1.assinarToken)({
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        admin: usuario.admin,
        ...acesso,
    });
    const refreshToken = await (0, sessaoService_1.criarRefreshToken)(usuario.id_usuario);
    const { iat, exp } = jsonwebtoken_1.default.decode(token);
    return {
        tipo: 'Bearer',
        token,
        expiraEm: exp - iat,
        refreshToken,
        usuario: { ...(0, usuarioService_1.paraRespostaPublica)(usuario), ...acesso },
    };
}
async function login(dados) {
    const usuario = await models_1.Usuario.findOne({ where: { email: dados.email } });
    if (!usuario || !usuario.senha) {
        (0, metricas_1.registrarEvento)('login_falha');
        logger_1.logger.warn({ motivo: 'usuário inexistente ou sem senha local' }, 'login falhou');
        throw new errorHandler_1.ErroHttp(401, 'Credenciais inválidas');
    }
    const senhaConfere = await bcrypt_1.default.compare(dados.senha, usuario.senha);
    if (!senhaConfere) {
        (0, metricas_1.registrarEvento)('login_falha');
        logger_1.logger.warn({ id_usuario: usuario.id_usuario, motivo: 'senha incorreta' }, 'login falhou');
        throw new errorHandler_1.ErroHttp(401, 'Credenciais inválidas');
    }
    const sessao = await iniciarSessao(usuario);
    (0, metricas_1.registrarEvento)('login_ok');
    logger_1.logger.info({ id_usuario: usuario.id_usuario, provedor: 'local' }, 'login realizado');
    return sessao;
}
async function loginGoogle(idToken) {
    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
    }
    catch {
        (0, metricas_1.registrarEvento)('login_falha');
        logger_1.logger.warn({ motivo: 'verifyIdToken rejeitou' }, 'login Google falhou');
        throw new errorHandler_1.ErroHttp(401, 'Token do Google inválido');
    }
    if (!payload?.email || !payload.email_verified) {
        (0, metricas_1.registrarEvento)('login_falha');
        throw new errorHandler_1.ErroHttp(401, 'Token do Google inválido ou e-mail não verificado');
    }
    let usuario = await models_1.Usuario.findOne({ where: { googleId: payload.sub } });
    if (!usuario) {
        usuario = await models_1.Usuario.findOne({ where: { email: payload.email } });
        if (usuario) {
            await usuario.update({ googleId: payload.sub, email_verificado: true });
            logger_1.logger.info({ id_usuario: usuario.id_usuario }, 'conta Google vinculada a conta existente');
        }
        else {
            usuario = await models_1.Usuario.create({
                nome: payload.name ?? payload.email,
                email: payload.email,
                provedor: 'google',
                googleId: payload.sub,
                email_verificado: true,
            });
            const cargo = await models_1.Cargo.findOne({ where: { nome: rbac_1.nomeCargoPadrao } });
            if (cargo)
                await usuario.addCargo(cargo);
            (0, metricas_1.registrarEvento)('cadastro_google');
            logger_1.logger.info({ id_usuario: usuario.id_usuario }, 'usuário criado via Google');
        }
    }
    const sessao = await iniciarSessao(usuario);
    (0, metricas_1.registrarEvento)('login_ok');
    logger_1.logger.info({ id_usuario: usuario.id_usuario, provedor: 'google' }, 'login realizado');
    return sessao;
}
async function renovarSessao(refreshToken) {
    const idUsuario = await (0, sessaoService_1.consumirRefreshToken)(refreshToken);
    if (!idUsuario) {
        (0, metricas_1.registrarEvento)('refresh_falha');
        logger_1.logger.warn({ motivo: 'refresh token inexistente, expirado ou já usado' }, 'renovação de sessão negada');
        throw new errorHandler_1.ErroHttp(401, 'Refresh token inválido ou expirado');
    }
    const usuario = await models_1.Usuario.findByPk(idUsuario);
    if (!usuario || !usuario.ativo) {
        await (0, sessaoService_1.revogarTodasAsSessoesSemFalhar)(idUsuario);
        (0, metricas_1.registrarEvento)('refresh_falha');
        logger_1.logger.warn({ id_usuario: idUsuario }, 'renovação negada: usuário inexistente ou inativo');
        throw new errorHandler_1.ErroHttp(401, 'Refresh token inválido ou expirado');
    }
    const sessao = await iniciarSessao(usuario);
    (0, metricas_1.registrarEvento)('refresh_ok');
    logger_1.logger.info({ id_usuario: idUsuario }, 'sessão renovada');
    return sessao;
}
async function encerrarSessao(refreshToken) {
    await (0, sessaoService_1.revogarRefreshToken)(refreshToken);
    (0, metricas_1.registrarEvento)('logout');
    logger_1.logger.info('logout realizado');
}
async function encerrarTodasAsSessoes(idUsuario) {
    await (0, sessaoService_1.revogarTodasAsSessoes)(idUsuario);
    (0, metricas_1.registrarEvento)('logout_todos');
    logger_1.logger.info({ id_usuario: idUsuario }, 'logout em todos os dispositivos');
}
