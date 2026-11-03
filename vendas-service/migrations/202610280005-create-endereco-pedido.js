'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('endereco_pedido', {
      id_endereco_pedido: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pedido', key: 'id_pedido' },
      },
      endereco: { type: Sequelize.STRING(255), allowNull: false },
      numero: { type: Sequelize.STRING(255), allowNull: false },
      complemento: { type: Sequelize.STRING(255), allowNull: true },
      bairro: { type: Sequelize.STRING(255), allowNull: true },
      cidade: { type: Sequelize.STRING(255), allowNull: false },
      estado: { type: Sequelize.STRING(255), allowNull: false },
      cep: { type: Sequelize.STRING(255), allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('endereco_pedido');
  },
};
