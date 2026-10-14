"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limitarCadastro = exports.limitarLogin = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const numero = (valor, padrao) => (valor ? Number(valor) : padrao);
function limitador(limite, janelaMinutos, mensagem) {
    return (0, express_rate_limit_1.rateLimit)({
        windowMs: janelaMinutos * 60 * 1000,
        limit: limite,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { erro: mensagem },
        skip: () => process.env.RATE_LIMIT_DESLIGADO === 'true',
    });
}
exports.limitarLogin = limitador(numero(process.env.RATE_LIMIT_LOGIN_MAX, 10), 15, 'Muitas tentativas de login. Tente novamente em alguns minutos.');
exports.limitarCadastro = limitador(numero(process.env.RATE_LIMIT_CADASTRO_MAX, 20), 60, 'Muitos cadastros a partir deste IP. Tente novamente mais tarde.');
