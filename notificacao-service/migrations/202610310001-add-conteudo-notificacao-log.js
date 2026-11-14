'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Guarda o conteúdo do e-mail para o reenvio automático e conta as rodadas de envio.
    await queryInterface.addColumn('notificacao_log', 'assunto', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('notificacao_log', 'texto', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('notificacao_log', 'tentativas', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('notificacao_log', 'tentativas');
    await queryInterface.removeColumn('notificacao_log', 'texto');
    await queryInterface.removeColumn('notificacao_log', 'assunto');
  },
};
