'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('endereco', {
      id_endereco: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'usuario', key: 'id_usuario' },
      },
      endereco: { type: Sequelize.STRING, allowNull: false },
      numero: { type: Sequelize.STRING, allowNull: false },
      complemento: { type: Sequelize.STRING, allowNull: true },
      bairro: { type: Sequelize.STRING, allowNull: true },
      cidade: { type: Sequelize.STRING, allowNull: false },
      estado: { type: Sequelize.STRING, allowNull: false },
      cep: { type: Sequelize.STRING, allowNull: false },
      principal: { type: Sequelize.BOOLEAN, defaultValue: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('endereco');
  },
};
