"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErroHttp = void 0;
exports.tratarErros = tratarErros;
class ErroHttp extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.ErroHttp = ErroHttp;
function tratarErros(err, _req, res, _next) {
    if (err instanceof ErroHttp) {
        return res.status(err.status).json({ erro: err.message });
    }
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
}
