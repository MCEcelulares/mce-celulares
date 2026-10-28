'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('reserva_estoque', {
      id_reserva_estoque: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: { type: Sequelize.INTEGER, allowNull: false },
      id_produto: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'produto', key: 'id_produto' },
      },
      quantidade: { 
        type: Sequelize.INTEGER, 
        allowNull: false 
      },
      status: { 
        type: Sequelize.STRING(20), 
        allowNull: false, 
        defaultValue: 'ATIVA' 
      },
      criado_em: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') 
      },
      atualizado_em: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') 
      },
    });
    await queryInterface.addIndex('reserva_estoque', ['id_pedido', 'id_produto'], {
      unique: true,
      name: 'uq_reserva_estoque_pedido_produto',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('reserva_estoque');
  },
};
