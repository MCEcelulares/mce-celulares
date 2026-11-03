'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('carrinho', {
      id_carrinho: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_usuario: { type: Sequelize.INTEGER, allowNull: false },
      data_criacao: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });
    await queryInterface.addIndex('carrinho', ['id_usuario', 'ativo'], { name: 'idx_carrinho_usuario_ativo' });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('carrinho');
  },
};
