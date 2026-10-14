"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obterAcesso = obterAcesso;
const models_1 = require("../models");
async function obterAcesso(idUsuario) {
    const usuario = await models_1.Usuario.findByPk(idUsuario, {
        include: [
            {
                model: models_1.Cargo,
                as: 'cargos',
                through: { attributes: [] },
                include: [{ model: models_1.Permissao, as: 'permissoes', through: { attributes: [] } }],
            },
        ],
    });
    const cargos = usuario?.cargos ?? [];
    const permissoes = new Set();
    for (const cargo of cargos) {
        for (const permissao of cargo.permissoes ?? []) {
            permissoes.add(permissao.nome);
        }
    }
    return { cargos: cargos.map((c) => c.nome), permissoes: [...permissoes].sort() };
}
