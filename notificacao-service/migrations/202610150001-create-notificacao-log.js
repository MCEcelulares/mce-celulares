'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notificacao_log', {
      id_notificacao: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: { type: Sequelize.INTEGER, allowNull: false },
      tipo: { type: Sequelize.STRING(30), allowNull: false },
      destinatario: { type: Sequelize.STRING(255), allowNull: false },
      status: { type: Sequelize.STRING(20), defaultValue: 'ENVIADO' },
      erro: { type: Sequelize.STRING(255) },
      enviado_em: { type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('notificacao_log', {
      fields: ['id_pedido', 'tipo'],
      type: 'unique',
      name: 'uq_pedido_tipo',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('notificacao_log');
  },
};
