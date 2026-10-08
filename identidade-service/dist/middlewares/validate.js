"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validar = validar;
function validar(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body);
        if (!resultado.success) {
            return res.status(400).json({ erro: 'Dados inválidos', detalhes: resultado.error.flatten() });
        }
        req.body = resultado.data;
        next();
    };
}
