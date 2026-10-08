'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cargo', {
      id_cargo: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING, allowNull: false, unique: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('cargo');
  },
};
