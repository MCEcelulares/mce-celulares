"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exigirPermissao = exigirPermissao;
exports.donoOuPermissao = donoOuPermissao;
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
function donoOuPermissao(permissao) {
    return (req, res, next) => {
        const auth = req.usuarioAutenticado;
        const ehDono = auth?.id_usuario === Number(req.params.id);
        const temPermissao = permissao !== undefined && auth?.permissoes.includes(permissao);
        if (!ehDono && !temPermissao) {
            logger_1.logger.warn({ id_usuario: auth?.id_usuario, recurso_de: req.params.id, permissao }, 'acesso negado: não é o dono do recurso');
            return res.status(403).json({ erro: 'Sem permissão para acessar este recurso' });
        }
        next();
    };
}
