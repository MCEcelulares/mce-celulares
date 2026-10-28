'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('item_pedido', {
      id_item: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pedido', key: 'id_pedido' },
      },
      id_produto: { type: Sequelize.INTEGER, allowNull: true },
      nome_produto: { type: Sequelize.STRING(150), allowNull: false },
      quantidade: { type: Sequelize.INTEGER, allowNull: false },
      preco_unitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('item_pedido');
  },
};
