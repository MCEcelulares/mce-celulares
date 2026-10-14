'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('usuario', {
      id_usuario: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      senha: { type: Sequelize.STRING, allowNull: true },
      cpf: { type: Sequelize.STRING, allowNull: true },
      telefone: { type: Sequelize.STRING, allowNull: true },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
      admin: { type: Sequelize.BOOLEAN, defaultValue: false },
      provedor: { type: Sequelize.STRING, defaultValue: 'local' },
      google_id: { type: Sequelize.STRING, allowNull: true, unique: true },
      email_verificado: { type: Sequelize.BOOLEAN, defaultValue: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('usuario');
  },
};
