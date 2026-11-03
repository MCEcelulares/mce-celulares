"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validar = validar;
function validar(schema, origem = 'body') {
    return (req, res, next) => {
        const resultado = schema.safeParse(req[origem]);
        if (!resultado.success) {
            return res.status(400).json({ erro: 'Dados inválidos', detalhes: resultado.error.flatten() });
        }
        Object.assign(req, { [origem]: resultado.data });
        next();
    };
}
