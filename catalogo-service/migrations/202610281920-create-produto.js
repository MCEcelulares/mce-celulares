'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('produto', {
            id_produto: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            nome: { 
                type: Sequelize.STRING, 
                allowNull: false 
            },
            descricao: { 
                type: Sequelize.TEXT, 
                allowNull: true 
            },
            preco: { 
                type: Sequelize.DECIMAL(10, 2), 
                allowNull: false 
            },
            estoque: { 
                type: Sequelize.INTEGER, 
                allowNull: false, 
                defaultValue: 0 
            },
            imagem: { 
                type: Sequelize.STRING, 
                allowNull: true 
            },
            destaque: { 
                type: Sequelize.BOOLEAN, 
                allowNull: false, 
                defaultValue: false 
            },
            ativo: { 
                type: Sequelize.BOOLEAN, 
                allowNull: false, 
                defaultValue: true 
            },
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
            criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        });
        await queryInterface.addIndex('produto', ['ativo', 'criado_em'], { name: 'idx_produto_ativo_criado_em' });
        await queryInterface.addIndex('produto', ['preco'], { name: 'idx_produto_preco' });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('produto');
    },
};
