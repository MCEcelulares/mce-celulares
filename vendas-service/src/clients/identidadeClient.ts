import { chamar } from './http';
import { ErroHttp } from '../middlewares/errorHandler';

const SERVICO = 'Identidade';
const base = () => process.env.IDENTIDADE_SERVICE_URL ?? 'http://identidade:3001';

export interface PerfilIdentidade {
  id_usuario: number;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  ativo: boolean;
}

export interface EnderecoIdentidade {
  id_endereco: number;
  endereco: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  cep: string;
}

// O Identidade só deixa o próprio usuário (ou quem tem usuarios:ver) ler estes dados,
// por isso o token do usuário logado é repassado (ver identidade.openapi.yaml).
async function consultar<T>(caminho: string, authorization: string): Promise<T | null> {
  const r = await chamar<T>(SERVICO, `${base()}${caminho}`, { headers: { Authorization: authorization }, tentativas: 2 });
  if (r.status === 200 && r.corpo) return r.corpo;
  if ([401, 403, 404].includes(r.status)) return null;
  throw new ErroHttp(502, 'Resposta inesperada do Identidade');
}

export function buscarUsuario(idUsuario: number, authorization: string) {
  return consultar<PerfilIdentidade>(`/usuarios/${idUsuario}`, authorization);
}

export function buscarEndereco(idUsuario: number, idEndereco: number, authorization: string) {
  return consultar<EnderecoIdentidade>(`/usuarios/${idUsuario}/enderecos/${idEndereco}`, authorization);
}
