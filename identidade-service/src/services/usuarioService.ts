import bcrypt from 'bcrypt';
import { Usuario, Cargo } from '../models';
import { ErroHttp } from '../middlewares/errorHandler';
import { CriarUsuarioInput } from '../validators/usuarioValidators';

export async function criarUsuario(dados: CriarUsuarioInput) {
  const jaExiste = await Usuario.findOne({ where: { email: dados.email } });
  if (jaExiste) {
    throw new ErroHttp(409, 'E-mail já cadastrado');
  }

  const senhaHash = await bcrypt.hash(dados.senha, 10);

  const usuario = await Usuario.create({
    nome: dados.nome,
    email: dados.email,
    senha: senhaHash,
    cpf: dados.cpf,
    telefone: dados.telefone,
  });

  const cargoCliente = await Cargo.findOne({ where: { nome: 'cliente' } });
  if (cargoCliente) {
    await usuario.addCargo(cargoCliente);
  }

  return paraRespostaPublica(usuario);
}

export async function buscarUsuarioPorId(id: number) {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) {
    throw new ErroHttp(404, 'Usuário não existe');
  }
  return paraRespostaPublica(usuario);
}

export function paraRespostaPublica(usuario: Usuario) {
  const { senha, ...resto } = usuario.toJSON() as Usuario & { senha?: string };
  return resto;
}
