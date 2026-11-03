'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('notificacao_log', 'criado_em', {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('notificacao_log', 'criado_em');
  },
};
