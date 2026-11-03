'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pedido', {
      id_pedido: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      data: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      valor_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      valor_frete: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      metodo_envio: { type: Sequelize.STRING(50), allowNull: true },
      prazo_entrega_dias: { type: Sequelize.INTEGER, allowNull: true },
      codigo_rastreio: { type: Sequelize.STRING(100), allowNull: true },
      id_envio_externo: { type: Sequelize.STRING(100), allowNull: true },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
      status: { type: Sequelize.STRING(30), defaultValue: 'AGUARDANDO_PAGAMENTO' },
    });
    await queryInterface.addIndex('pedido', ['status'], { name: 'idx_pedido_status' });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('pedido');
  },
};
