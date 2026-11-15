import { Op, UniqueConstraintError, WhereOptions } from "sequelize";
import { Cargo, Permissao, Usuario, UsuarioCargo } from "../models";
import { ListarUsuariosQuery } from "../validators/usuarioValidators";
import { RegistroDuplicadoError } from "./erros";

export type CamposUsuario = Partial<
  Pick<
    Usuario,
    | "nome"
    | "email"
    | "senha"
    | "cpf"
    | "telefone"
    | "ativo"
    | "provedor"
    | "googleId"
    | "email_verificado"
  >
>;

export type NovoUsuario = CamposUsuario & Pick<Usuario, "nome" | "email">;

function traduzirErro(err: unknown): unknown {
  return err instanceof UniqueConstraintError ? new RegistroDuplicadoError() : err;
}

export function buscarPorId(id: number) {
  return Usuario.findByPk(id);
}

export function buscarPorEmail(email: string) {
  return Usuario.findOne({ where: { email } });
}

export function buscarPorGoogleId(googleId: string) {
  return Usuario.findOne({ where: { googleId } });
}

export async function criar(dados: NovoUsuario) {
  try {
    return await Usuario.create(dados);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function atualizar(usuario: Usuario, campos: CamposUsuario) {
  try {
    return await usuario.update(campos);
  } catch (err) {
    throw traduzirErro(err);
  }
}

export function adicionarCargo(usuario: Usuario, cargo: Cargo) {
  return usuario.addCargo(cargo);
}

export function definirCargos(usuario: Usuario, cargos: Cargo[]) {
  return usuario.setCargos(cargos);
}

export async function possuiCargo(idUsuario: number, idCargo: number) {
  const vinculos = await UsuarioCargo.count({ where: { id_usuario: idUsuario, id_cargo: idCargo } });
  return vinculos > 0;
}

export function contarAtivosComCargo(nomeCargo: string) {
  return Usuario.count({
    where: { ativo: true },
    include: [{ model: Cargo, as: "cargos", where: { nome: nomeCargo }, required: true }],
    distinct: true,
  });
}

export async function listar({ page, limit, busca, cargo, ativo }: ListarUsuariosQuery) {
  const filtros: WhereOptions[] = [];
  if (busca) {
    filtros.push({
      [Op.or]: [{ nome: { [Op.like]: `%${busca}%` } }, { email: { [Op.like]: `%${busca}%` } }],
    });
  }
  if (ativo !== undefined) {
    filtros.push({ ativo });
  }

  const { rows, count } = await Usuario.findAndCountAll({
    where: filtros.length > 0 ? { [Op.and]: filtros } : {},
    attributes: { exclude: ["senha"] },
    include: [
      {
        model: Cargo,
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
  return { registros: rows, total: count };
}

// Usuário com os cargos e as permissões de cada cargo (base do RBAC).
export function buscarComCargosEPermissoes(idUsuario: number) {
  return Usuario.findByPk(idUsuario, {
    include: [
      {
        model: Cargo,
        as: "cargos",
        through: { attributes: [] },
        include: [{ model: Permissao, as: "permissoes", through: { attributes: [] } }],
      },
    ],
  });
}
