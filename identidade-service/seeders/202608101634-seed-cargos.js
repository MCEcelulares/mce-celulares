'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert(
      'cargo',
      [
        { nome: 'cliente' },
        { nome: 'vendas' },
        { nome: 'atendimento' },
        { nome: 'auditor' },
        { nome: 'administrador' },
      ],
      { ignoreDuplicates: true }
    );
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('cargo', null, {});
  },
};
