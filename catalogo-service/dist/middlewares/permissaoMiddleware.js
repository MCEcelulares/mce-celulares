"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exigirPermissao = exigirPermissao;
exports.temPermissao = temPermissao;
const logger_1 = require("../utils/logger");
function exigirPermissao(...permissoes) {
    return (req, res, next) => {
        const temAlguma = permissoes.some((p) => req.usuarioAutenticado?.permissoes.includes(p));
        if (!temAlguma) {
            logger_1.logger.warn({ id_usuario: req.usuarioAutenticado?.id_usuario, permissoes }, 'acesso negado: permissão ausente');
            return res.status(403).json({ erro: 'Sem permissão para esta ação' });
        }
        next();
    };
}
function temPermissao(req, permissao) {
    return req.usuarioAutenticado?.permissoes.includes(permissao) ?? false;
}
