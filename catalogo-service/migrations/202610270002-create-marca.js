'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('marca', {
      id_marca: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING(255), allowNull: false },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('marca');
  },
};
