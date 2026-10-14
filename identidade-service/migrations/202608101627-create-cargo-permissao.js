'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cargo_permissao', {
      id_cargo: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'cargo', key: 'id_cargo' },
      },
      id_permissao: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'permissao', key: 'id_permissao' },
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('cargo_permissao');
  },
};
