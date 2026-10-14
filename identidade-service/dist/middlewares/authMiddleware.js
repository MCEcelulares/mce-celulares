"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autenticar = autenticar;
const jwt_1 = require("../utils/jwt");
function autenticar(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não enviado' });
    }
    const token = header.slice('Bearer '.length);
    try {
        const payload = (0, jwt_1.validarToken)(token);
        req.usuarioAutenticado = {
            ...payload,
            cargos: payload.cargos ?? [],
            permissoes: payload.permissoes ?? [],
        };
        next();
    }
    catch {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
}
