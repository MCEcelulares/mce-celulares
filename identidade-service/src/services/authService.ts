import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Usuario, Cargo } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { assinarToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { registrarEvento } from '../utils/metricas';
import { nomeCargoPadrao } from '../config/rbac';
import { LoginInput } from '../validators/authValidators';
import { paraRespostaPublica } from './usuarioService';
import { obterAcesso } from './rbacService';
import {
  criarRefreshToken,
  consumirRefreshToken,
  revogarRefreshToken,
  revogarTodasAsSessoes,
  revogarTodasAsSessoesSemFalhar,
} from './sessaoService';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function iniciarSessao(usuario: Usuario) {
  if (!usuario.ativo) {
    logger.warn({ id_usuario: usuario.id_usuario }, 'sessão negada: conta inativa');
    throw new ErroHttp(403, 'Conta inativa');
  }

  const acesso = await obterAcesso(usuario.id_usuario);
  const token = assinarToken({
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    admin: usuario.admin,
    ...acesso,
  });
  const refreshToken = await criarRefreshToken(usuario.id_usuario);

  const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };

  return {
    tipo: 'Bearer',
    token,
    expiraEm: exp - iat, 
    refreshToken, 
    usuario: { ...paraRespostaPublica(usuario), ...acesso },
  };
}

export async function login(dados: LoginInput) {
  const usuario = await Usuario.findOne({ where: { email: dados.email } });
  if (!usuario || !usuario.senha) {
    registrarEvento('login_falha');
    logger.warn({ motivo: 'usuário inexistente ou sem senha local' }, 'login falhou');
    throw new ErroHttp(401, 'Credenciais inválidas');
  }

  const senhaConfere = await bcrypt.compare(dados.senha, usuario.senha);
  if (!senhaConfere) {
    registrarEvento('login_falha');
    logger.warn({ id_usuario: usuario.id_usuario, motivo: 'senha incorreta' }, 'login falhou');
    throw new ErroHttp(401, 'Credenciais inválidas');
  }

  const sessao = await iniciarSessao(usuario);
  registrarEvento('login_ok');
  logger.info({ id_usuario: usuario.id_usuario, provedor: 'local' }, 'login realizado');
  return sessao;
}

export async function loginGoogle(idToken: string) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    registrarEvento('login_falha');
    logger.warn({ motivo: 'verifyIdToken rejeitou' }, 'login Google falhou');
    throw new ErroHttp(401, 'Token do Google inválido');
  }

  if (!payload?.email || !payload.email_verified) {
    registrarEvento('login_falha');
    throw new ErroHttp(401, 'Token do Google inválido ou e-mail não verificado');
  }

  let usuario = await Usuario.findOne({ where: { googleId: payload.sub } });

  if (!usuario) {
    usuario = await Usuario.findOne({ where: { email: payload.email } });
    if (usuario) {
      await usuario.update({ googleId: payload.sub, email_verificado: true });
      logger.info({ id_usuario: usuario.id_usuario }, 'conta Google vinculada a conta existente');
    } else {
      usuario = await Usuario.create({
        nome: payload.name ?? payload.email,
        email: payload.email,
        provedor: 'google',
        googleId: payload.sub,
        email_verificado: true,
      });
      const cargo = await Cargo.findOne({ where: { nome: nomeCargoPadrao } });
      if (cargo) await usuario.addCargo(cargo);
      registrarEvento('cadastro_google');
      logger.info({ id_usuario: usuario.id_usuario }, 'usuário criado via Google');
    }
  }

  const sessao = await iniciarSessao(usuario);
  registrarEvento('login_ok');
  logger.info({ id_usuario: usuario.id_usuario, provedor: 'google' }, 'login realizado');
  return sessao;
}

export async function renovarSessao(refreshToken: string) {
  const idUsuario = await consumirRefreshToken(refreshToken);
  if (!idUsuario) {
    registrarEvento('refresh_falha');
    logger.warn({ motivo: 'refresh token inexistente, expirado ou já usado' }, 'renovação de sessão negada');
    throw new ErroHttp(401, 'Refresh token inválido ou expirado');
  }

  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario || !usuario.ativo) {
    await revogarTodasAsSessoesSemFalhar(idUsuario);
    registrarEvento('refresh_falha');
    logger.warn({ id_usuario: idUsuario }, 'renovação negada: usuário inexistente ou inativo');
    throw new ErroHttp(401, 'Refresh token inválido ou expirado');
  }

  const sessao = await iniciarSessao(usuario);
  registrarEvento('refresh_ok');
  logger.info({ id_usuario: idUsuario }, 'sessão renovada');
  return sessao;
}

export async function encerrarSessao(refreshToken: string) {
  await revogarRefreshToken(refreshToken);
  registrarEvento('logout');
  logger.info('logout realizado');
}

export async function encerrarTodasAsSessoes(idUsuario: number) {
  await revogarTodasAsSessoes(idUsuario);
  registrarEvento('logout_todos');
  logger.info({ id_usuario: idUsuario }, 'logout em todos os dispositivos');
}
