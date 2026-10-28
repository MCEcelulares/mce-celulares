'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('usuario_pedido', {
      id_usuario_pedido: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pedido', key: 'id_pedido' },
      },
      nome: { type: Sequelize.STRING(255), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false },
      cpf: { type: Sequelize.STRING(255), allowNull: false },
      telefone: { type: Sequelize.STRING(255), allowNull: false },
      id_usuario: { type: Sequelize.INTEGER, allowNull: true },
    });
    await queryInterface.addIndex('usuario_pedido', ['id_usuario'], { name: 'idx_usuario_pedido_usuario' });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('usuario_pedido');
  },
};
