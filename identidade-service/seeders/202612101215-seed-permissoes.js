'use strict';

const nomesDasPermissoes = [
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
];

const permissoesPorCargo = {
  cliente: [],
  vendas: [
    'painel:acessar', 'dashboard:ver', 'usuarios:listar', 'usuarios:ver',
    'catalogo:gerenciar', 'pedidos:listar-todos', 'pedidos:atualizar-status',
  ],
  atendimento: ['painel:acessar', 'usuarios:listar', 'usuarios:ver', 'pedidos:listar-todos'],
  auditor: ['painel:acessar', 'dashboard:ver', 'usuarios:listar', 'usuarios:ver', 'pedidos:listar-todos'],
  administrador: nomesDasPermissoes,
};

module.exports = {
  nomesDasPermissoes,

  up: async (queryInterface) => {
    const { QueryTypes } = queryInterface.sequelize;

    await queryInterface.bulkInsert('permissao', nomesDasPermissoes.map((nome) => ({ nome })), { ignoreDuplicates: true });

    const cargos = await queryInterface.sequelize.query('SELECT id_cargo, nome FROM cargo', { type: QueryTypes.SELECT });
    const permissoes = await queryInterface.sequelize.query('SELECT id_permissao, nome FROM permissao', { type: QueryTypes.SELECT });

    const idCargo = Object.fromEntries(cargos.map((c) => [c.nome, c.id_cargo]));
    const idPermissao = Object.fromEntries(permissoes.map((p) => [p.nome, p.id_permissao]));

    const vinculos = [];
    for (const [cargo, nomes] of Object.entries(permissoesPorCargo)) {
      for (const nome of nomes) {
        vinculos.push({ id_cargo: idCargo[cargo], id_permissao: idPermissao[nome] });
      }
    }

    if (vinculos.length > 0) {
      await queryInterface.bulkInsert('cargo_permissao', vinculos, { ignoreDuplicates: true });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('cargo_permissao', null, {});
    await queryInterface.bulkDelete('permissao', null, {});
  },
};
