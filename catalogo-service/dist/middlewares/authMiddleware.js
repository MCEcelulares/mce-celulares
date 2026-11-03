"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autenticar = autenticar;
exports.autenticarOpcional = autenticarOpcional;
const jwt_1 = require("../utils/jwt");
function lerToken(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return null;
    try {
        const payload = (0, jwt_1.validarToken)(header.slice('Bearer '.length));
        return { ...payload, cargos: payload.cargos ?? [], permissoes: payload.permissoes ?? [] };
    }
    catch {
        return null;
    }
}
function autenticar(req, res, next) {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não enviado' });
    }
    const payload = lerToken(req);
    if (!payload) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
    req.usuarioAutenticado = payload;
    next();
}
// Rotas públicas (vitrine): com token válido o usuário ganha visão de gestão; token ausente ou expirado = visitante.
function autenticarOpcional(req, _res, next) {
    const payload = lerToken(req);
    if (payload)
        req.usuarioAutenticado = payload;
    next();
}
