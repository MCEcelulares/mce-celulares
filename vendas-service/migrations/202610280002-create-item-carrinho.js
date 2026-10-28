'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('item_carrinho', {
      id_item_carrinho: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_carrinho: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'carrinho', key: 'id_carrinho' },
      },
      id_produto: { type: Sequelize.INTEGER, allowNull: false },
      preco_unitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantidade: { type: Sequelize.INTEGER, allowNull: false },
    });
    await queryInterface.addConstraint('item_carrinho', {
      fields: ['id_carrinho', 'id_produto'],
      type: 'unique',
      name: 'uq_carrinho_produto',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('item_carrinho');
  },
};
