"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paraRespostaPublica = paraRespostaPublica;
exports.criarUsuario = criarUsuario;
exports.buscarUsuarioPorId = buscarUsuarioPorId;
exports.atualizarPerfil = atualizarPerfil;
exports.atualizarUsuarioComoAdmin = atualizarUsuarioComoAdmin;
exports.alterarSenha = alterarSenha;
exports.listarUsuarios = listarUsuarios;
exports.definirCargos = definirCargos;
exports.alterarStatus = alterarStatus;
exports.excluirUsuario = excluirUsuario;
const bcrypt_1 = __importDefault(require("bcrypt"));
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("../utils/logger");
const metricas_1 = require("../utils/metricas");
const rbac_1 = require("../config/rbac");
const rbacService_1 = require("./rbacService");
const sessaoService_1 = require("./sessaoService");
function paraRespostaPublica(usuario) {
    const { senha, ...resto } = usuario.toJSON();
    return resto;
}
async function montarPerfil(usuario) {
    const acesso = await (0, rbacService_1.obterAcesso)(usuario.id_usuario);
    return { ...paraRespostaPublica(usuario), ...acesso };
}
async function obterUsuarioOuFalhar(id) {
    const usuario = await models_1.Usuario.findByPk(id);
    if (!usuario) {
        throw new errorHandler_1.ErroHttp(404, "Usuário não existe");
    }
    return usuario;
}
async function ehUltimoAdministradorAtivo(usuario) {
    if (!usuario.ativo)
        return false;
    const cargoAdmin = await models_1.Cargo.findOne({ where: { nome: rbac_1.nomeCargoAdmin } });
    if (!cargoAdmin)
        return false;
    const ehAdmin = (await models_1.UsuarioCargo.count({
        where: { id_usuario: usuario.id_usuario, id_cargo: cargoAdmin.id_cargo },
    })) > 0;
    if (!ehAdmin)
        return false;
    const adminsAtivos = await models_1.Usuario.count({
        where: { ativo: true },
        include: [
            {
                model: models_1.Cargo,
                as: "cargos",
                where: { nome: rbac_1.nomeCargoAdmin },
                required: true,
            },
        ],
        distinct: true,
    });
    return adminsAtivos <= 1;
}
async function criarUsuario(dados) {
    const senhaHash = await bcrypt_1.default.hash(dados.senha, 10);
    let usuario;
    try {
        usuario = await models_1.Usuario.create({
            nome: dados.nome,
            email: dados.email,
            senha: senhaHash,
            cpf: dados.cpf,
            telefone: dados.telefone,
        });
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, "E-mail já cadastrado");
        }
        throw err;
    }
    const cargoCliente = await models_1.Cargo.findOne({
        where: { nome: rbac_1.nomeCargoPadrao },
    });
    if (cargoCliente) {
        await usuario.addCargo(cargoCliente);
    }
    (0, metricas_1.registrarEvento)("cadastro");
    logger_1.logger.info({ id_usuario: usuario.id_usuario }, "usuário cadastrado");
    return montarPerfil(usuario);
}
async function buscarUsuarioPorId(id) {
    return montarPerfil(await obterUsuarioOuFalhar(id));
}
async function atualizarPerfil(id, dados) {
    const usuario = await obterUsuarioOuFalhar(id);
    await usuario.update(dados);
    logger_1.logger.info({ id_usuario: id, campos: Object.keys(dados) }, "perfil atualizado");
    return montarPerfil(usuario);
}
async function atualizarUsuarioComoAdmin(id, dados, alteradoPor) {
    const usuario = await obterUsuarioOuFalhar(id);
    try {
        await usuario.update(dados);
    }
    catch (err) {
        if (err instanceof sequelize_1.UniqueConstraintError) {
            throw new errorHandler_1.ErroHttp(409, "E-mail já cadastrado");
        }
        throw err;
    }
    logger_1.logger.info({ id_usuario: id, campos: Object.keys(dados), alteradoPor }, "usuário atualizado por administrador");
    return montarPerfil(usuario);
}
async function alterarSenha(id, dados) {
    const usuario = await obterUsuarioOuFalhar(id);
    if (!usuario.senha) {
        throw new errorHandler_1.ErroHttp(400, "Esta conta não possui senha local");
    }
    const confere = await bcrypt_1.default.compare(dados.senhaAtual, usuario.senha);
    if (!confere) {
        logger_1.logger.warn({ id_usuario: id }, "troca de senha negada: senha atual incorreta");
        throw new errorHandler_1.ErroHttp(401, "Senha atual incorreta");
    }
    await usuario.update({ senha: await bcrypt_1.default.hash(dados.novaSenha, 10) });
    await (0, sessaoService_1.revogarTodasAsSessoesSemFalhar)(id);
    logger_1.logger.info({ id_usuario: id }, "senha alterada");
}
async function listarUsuarios({ page, limit, busca, cargo, ativo, }) {
    const filtros = [];
    if (busca) {
        filtros.push({
            [sequelize_1.Op.or]: [
                { nome: { [sequelize_1.Op.like]: `%${busca}%` } },
                { email: { [sequelize_1.Op.like]: `%${busca}%` } },
            ],
        });
    }
    if (ativo !== undefined) {
        filtros.push({ ativo });
    }
    const { rows, count } = await models_1.Usuario.findAndCountAll({
        where: filtros.length > 0 ? { [sequelize_1.Op.and]: filtros } : {},
        attributes: { exclude: ["senha"] },
        include: [
            {
                model: models_1.Cargo,
                as: "cargos",
                attributes: ["id_cargo", "nome"],
                through: { attributes: [] },
                ...(cargo ? { where: { nome: cargo }, required: true } : {}),
            },
        ],
        order: [["id_usuario", "ASC"]],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
    });
    return {
        dados: rows,
        paginacao: {
            pagina: page,
            limite: limit,
            total: count,
            totalPaginas: Math.ceil(count / limit),
        },
    };
}
async function definirCargos(idUsuario, nomes, alteradoPor) {
    const usuario = await obterUsuarioOuFalhar(idUsuario);
    const unicos = [...new Set(nomes)];
    const cargos = await models_1.Cargo.findAll({ where: { nome: unicos } });
    const inexistentes = unicos.filter((n) => !cargos.some((c) => c.nome === n));
    if (inexistentes.length > 0) {
        throw new errorHandler_1.ErroHttp(400, `Cargo(s) inexistente(s): ${inexistentes.join(", ")}`);
    }
    if (!unicos.includes(rbac_1.nomeCargoAdmin) &&
        (await ehUltimoAdministradorAtivo(usuario))) {
        throw new errorHandler_1.ErroHttp(409, "Não é possível remover o cargo do último administrador ativo");
    }
    await usuario.setCargos(cargos);
    logger_1.logger.info({ id_usuario: idUsuario, cargos: unicos, alteradoPor }, "cargos do usuário atualizados");
    return montarPerfil(usuario);
}
async function alterarStatus(idUsuario, ativo, alteradoPor) {
    const usuario = await obterUsuarioOuFalhar(idUsuario);
    if (!ativo) {
        if (idUsuario === alteradoPor) {
            throw new errorHandler_1.ErroHttp(409, "Você não pode desativar a própria conta");
        }
        if (await ehUltimoAdministradorAtivo(usuario)) {
            throw new errorHandler_1.ErroHttp(409, "Não é possível desativar o último administrador ativo");
        }
    }
    await usuario.update({ ativo });
    if (!ativo) {
        await (0, sessaoService_1.revogarTodasAsSessoesSemFalhar)(idUsuario);
    }
    (0, metricas_1.registrarEvento)(ativo ? "conta_reativada" : "conta_desativada");
    logger_1.logger.info({ id_usuario: idUsuario, ativo, alteradoPor }, "status da conta alterado");
    return montarPerfil(usuario);
}
async function excluirUsuario(idUsuario, excluidoPor) {
    await alterarStatus(idUsuario, false, excluidoPor);
    logger_1.logger.info({ id_usuario: idUsuario, excluidoPor }, "usuário excluído (exclusão lógica)");
}
