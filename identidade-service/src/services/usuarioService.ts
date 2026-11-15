import bcrypt from "bcrypt";
import type { Usuario } from "../models";
import * as usuarioRepository from "../repositories/usuarioRepository";
import * as cargoRepository from "../repositories/cargoRepository";
import { RegistroDuplicadoError } from "../repositories/erros";
import { ErroHttp } from "../middlewares/errorHandler";
import { logger } from "../utils/logger";
import { registrarEvento } from "../utils/metricas";
import { nomeCargoAdmin, nomeCargoPadrao } from "../config/rbac";
import {
  CriarUsuarioInput,
  AtualizarPerfilInput,
  AtualizarUsuarioAdminInput,
  AlterarSenhaInput,
  ListarUsuariosQuery,
} from "../validators/usuarioValidators";
import { obterAcesso } from "./rbacService";
import { revogarTodasAsSessoesSemFalhar } from "./sessaoService";

export function paraRespostaPublica(usuario: Usuario) {
  const { senha, ...resto } = usuario.toJSON() as Usuario & { senha?: string };
  return resto;
}

async function montarPerfil(usuario: Usuario) {
  const acesso = await obterAcesso(usuario.id_usuario);
  return { ...paraRespostaPublica(usuario), ...acesso };
}

async function obterUsuarioOuFalhar(id: number) {
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) {
    throw new ErroHttp(404, "Usuário não existe");
  }
  return usuario;
}

async function ehUltimoAdministradorAtivo(usuario: Usuario): Promise<boolean> {
  if (!usuario.ativo) return false;
  const cargoAdmin = await cargoRepository.buscarPorNome(nomeCargoAdmin);
  if (!cargoAdmin) return false;

  const ehAdmin = await usuarioRepository.possuiCargo(usuario.id_usuario, cargoAdmin.id_cargo);
  if (!ehAdmin) return false;

  const adminsAtivos = await usuarioRepository.contarAtivosComCargo(nomeCargoAdmin);
  return adminsAtivos <= 1;
}

export async function criarUsuario(dados: CriarUsuarioInput) {
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  let usuario: Usuario;
  try {
    usuario = await usuarioRepository.criar({
      nome: dados.nome,
      email: dados.email,
      senha: senhaHash,
      cpf: dados.cpf,
      telefone: dados.telefone,
    });
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
      throw new ErroHttp(409, "E-mail já cadastrado");
    }
    throw err;
  }

  const cargoCliente = await cargoRepository.buscarPorNome(nomeCargoPadrao);
  if (cargoCliente) {
    await usuarioRepository.adicionarCargo(usuario, cargoCliente);
  }

  registrarEvento("cadastro");
  logger.info({ id_usuario: usuario.id_usuario }, "usuário cadastrado");
  return montarPerfil(usuario);
}

export async function buscarUsuarioPorId(id: number) {
  return montarPerfil(await obterUsuarioOuFalhar(id));
}

export async function atualizarPerfil(id: number, dados: AtualizarPerfilInput) {
  const usuario = await obterUsuarioOuFalhar(id);
  await usuarioRepository.atualizar(usuario, dados);
  logger.info(
    { id_usuario: id, campos: Object.keys(dados) },
    "perfil atualizado",
  );
  return montarPerfil(usuario);
}

export async function atualizarUsuarioComoAdmin(
  id: number,
  dados: AtualizarUsuarioAdminInput,
  alteradoPor: number,
) {
  const usuario = await obterUsuarioOuFalhar(id);
  try {
    await usuarioRepository.atualizar(usuario, dados);
  } catch (err) {
    if (err instanceof RegistroDuplicadoError) {
      throw new ErroHttp(409, "E-mail já cadastrado");
    }
    throw err;
  }
  logger.info(
    { id_usuario: id, campos: Object.keys(dados), alteradoPor },
    "usuário atualizado por administrador",
  );
  return montarPerfil(usuario);
}

export async function alterarSenha(id: number, dados: AlterarSenhaInput) {
  const usuario = await obterUsuarioOuFalhar(id);

  if (!usuario.senha) {
    throw new ErroHttp(400, "Esta conta não possui senha local");
  }

  const confere = await bcrypt.compare(dados.senhaAtual, usuario.senha);
  if (!confere) {
    logger.warn(
      { id_usuario: id },
      "troca de senha negada: senha atual incorreta",
    );
    throw new ErroHttp(401, "Senha atual incorreta");
  }

  await usuarioRepository.atualizar(usuario, { senha: await bcrypt.hash(dados.novaSenha, 10) });
  await revogarTodasAsSessoesSemFalhar(id);
  logger.info({ id_usuario: id }, "senha alterada");
}

export async function listarUsuarios(consulta: ListarUsuariosQuery) {
  const { page, limit } = consulta;
  const { registros, total } = await usuarioRepository.listar(consulta);

  return {
    dados: registros,
    paginacao: {
      pagina: page,
      limite: limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    },
  };
}

export async function definirCargos(
  idUsuario: number,
  nomes: string[],
  alteradoPor: number,
) {
  const usuario = await obterUsuarioOuFalhar(idUsuario);

  const unicos = [...new Set(nomes)];
  const cargos = await cargoRepository.buscarPorNomes(unicos);
  const inexistentes = unicos.filter((n) => !cargos.some((c) => c.nome === n));
  if (inexistentes.length > 0) {
    throw new ErroHttp(
      400,
      `Cargo(s) inexistente(s): ${inexistentes.join(", ")}`,
    );
  }

  if (
    !unicos.includes(nomeCargoAdmin) &&
    (await ehUltimoAdministradorAtivo(usuario))
  ) {
    throw new ErroHttp(
      409,
      "Não é possível remover o cargo do último administrador ativo",
    );
  }

  await usuarioRepository.definirCargos(usuario, cargos);
  logger.info(
    { id_usuario: idUsuario, cargos: unicos, alteradoPor },
    "cargos do usuário atualizados",
  );
  return montarPerfil(usuario);
}
export async function alterarStatus(
  idUsuario: number,
  ativo: boolean,
  alteradoPor: number,
) {
  const usuario = await obterUsuarioOuFalhar(idUsuario);

  if (!ativo) {
    if (idUsuario === alteradoPor) {
      throw new ErroHttp(409, "Você não pode desativar a própria conta");
    }
    if (await ehUltimoAdministradorAtivo(usuario)) {
      throw new ErroHttp(
        409,
        "Não é possível desativar o último administrador ativo",
      );
    }
  }

  await usuarioRepository.atualizar(usuario, { ativo });
  if (!ativo) {
    await revogarTodasAsSessoesSemFalhar(idUsuario);
  }

  registrarEvento(ativo ? "conta_reativada" : "conta_desativada");
  logger.info(
    { id_usuario: idUsuario, ativo, alteradoPor },
    "status da conta alterado",
  );
  return montarPerfil(usuario);
}

export async function excluirUsuario(idUsuario: number, excluidoPor: number) {
  await alterarStatus(idUsuario, false, excluidoPor);
  logger.info(
    { id_usuario: idUsuario, excluidoPor },
    "usuário excluído (exclusão lógica)",
  );
}
