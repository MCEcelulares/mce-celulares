export const cargosProtegidos = ['cliente', 'administrador'] as const;
export const nomeCargoAdmin = 'administrador';
export const nomeCargoPadrao = 'cliente';

export const permissoesDoSistema = [
  'painel:acessar',
  'dashboard:ver',
  'usuarios:listar',
  'usuarios:ver',
  'usuarios:editar',
  'usuarios:excluir',
  'usuarios:gerenciar-cargos',
  'cargos:gerenciar',
  'catalogo:gerenciar',
  'pedidos:listar-todos',
  'pedidos:atualizar-status',
  'pedidos:cancelar',
] as const;
