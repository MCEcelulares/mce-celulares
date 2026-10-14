'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('permissao', {
      id_permissao: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING, allowNull: false, unique: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('permissao');
  },
};
