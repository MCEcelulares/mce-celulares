'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pagamento', {
      id_pagamento: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_pedido: { type: Sequelize.INTEGER, allowNull: false },
      id_usuario: { type: Sequelize.INTEGER, allowNull: false },
      metodo_pagamento: { type: Sequelize.STRING(255), allowNull: false },
      valor: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      data_pagamento: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.STRING(20), defaultValue: 'PENDENTE' },
      id_externo: { type: Sequelize.STRING(100), allowNull: true },
      url_pagamento: { type: Sequelize.STRING(500), allowNull: true },
    });
    await queryInterface.addConstraint('pagamento', {
      fields: ['id_pedido'],
      type: 'unique',
      name: 'uq_pagamento_pedido',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('pagamento');
  },
};
