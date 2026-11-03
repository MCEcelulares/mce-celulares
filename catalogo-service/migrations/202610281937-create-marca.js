'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('marca', {
      id_marca: { 
        type: Sequelize.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
      },
      nome: { 
        type: Sequelize.STRING(100), 
        allowNull: false, 
        unique: true 
      },
      descricao: { 
        type: Sequelize.TEXT, 
        allowNull: true 
      },
      ativo: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: true 
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('marca');
  },
};
