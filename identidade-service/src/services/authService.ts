import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Usuario } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { assinarToken } from '../utils/jwt';
import { LoginInput } from '../validators/authValidators';
import { paraRespostaPublica } from './usuarioService';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function login(dados: LoginInput) {
  const usuario = await Usuario.findOne({ where: { email: dados.email } });
  if (!usuario || !usuario.senha) {
    throw new ErroHttp(401, 'Credenciais inválidas');
  }

  const senhaConfere = await bcrypt.compare(dados.senha, usuario.senha);
  if (!senhaConfere) {
    throw new ErroHttp(401, 'Credenciais inválidas');
  }

  const token = assinarToken({
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    admin: usuario.admin,
  });

  return { token, usuario: paraRespostaPublica(usuario) };
}

export async function loginGoogle(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new ErroHttp(401, 'Token do Google inválido');
  }

  let usuario = await Usuario.findOne({ where: { googleId: payload.sub } });

  if (!usuario) {
    usuario = await Usuario.create({
      nome: payload.name ?? payload.email,
      email: payload.email,
      provedor: 'google',
      googleId: payload.sub,
      email_verificado: payload.email_verified ?? false,
    });
  }

  const token = assinarToken({
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    admin: usuario.admin,
  });

  return { token, usuario: paraRespostaPublica(usuario) };
}
