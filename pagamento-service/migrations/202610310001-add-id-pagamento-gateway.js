'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('pagamento', 'id_pagamento_gateway', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('pagamento', 'id_pagamento_gateway');
  },
};
