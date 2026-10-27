'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('produto', {
      id_produto: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: Sequelize.STRING(255), allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: true },
      preco: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      estoque: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      imagem: { type: Sequelize.STRING(255), allowNull: true },
      destaque: { type: Sequelize.BOOLEAN, defaultValue: false },
      ativo: { type: Sequelize.BOOLEAN, defaultValue: true },
      peso: { type: Sequelize.DECIMAL(6, 3), allowNull: true },
      altura: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      largura: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      comprimento: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      id_marca: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'marca', key: 'id_marca' },
      },
      id_categoria: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'categoria', key: 'id_categoria' },
      },
      criado_em: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('produto');
  },
};
