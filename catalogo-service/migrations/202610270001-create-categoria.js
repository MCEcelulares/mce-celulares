'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('categoria', {
      id_categoria: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING(255), allowNull: false },
      icone: { type: Sequelize.STRING(255), allowNull: true },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('categoria');
  },
};
