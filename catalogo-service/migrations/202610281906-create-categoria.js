'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('categoria', {
            id_categoria: {
                type: Sequelize.INTEGER,
                primaryKey: true, 
                autoIncrement: true 
            },
            nome: { 
                type: Sequelize.STRING(100), 
                allowNull: false, 
                unique: true 
            },
            icone: { 
                type: Sequelize.STRING, 
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
        await queryInterface.dropTable('categoria');
    },
};
