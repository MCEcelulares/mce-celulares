import { Usuario, Cargo, Permissao } from '../models';

export interface AcessoUsuario {
  cargos: string[];
  permissoes: string[];
}

export async function obterAcesso(idUsuario: number): Promise<AcessoUsuario> {
  const usuario = await Usuario.findByPk(idUsuario, {
    include: [
      {
        model: Cargo,
        as: 'cargos',
        through: { attributes: [] },
        include: [{ model: Permissao, as: 'permissoes', through: { attributes: [] } }],
      },
    ],
  });

  const cargos = usuario?.cargos ?? [];
  const permissoes = new Set<string>();
  for (const cargo of cargos) {
    for (const permissao of cargo.permissoes ?? []) {
      permissoes.add(permissao.nome);
    }
  }

  return { cargos: cargos.map((c) => c.nome), permissoes: [...permissoes].sort() };
}
