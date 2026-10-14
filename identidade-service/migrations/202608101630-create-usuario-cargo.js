'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('usuario_cargo', {
      id_usuario: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'usuario', key: 'id_usuario' },
      },
      id_cargo: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'cargo', key: 'id_cargo' },
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('usuario_cargo');
  },
};
