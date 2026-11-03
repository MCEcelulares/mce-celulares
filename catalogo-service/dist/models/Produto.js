"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Produto = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Produto extends sequelize_1.Model {
}
exports.Produto = Produto;
Produto.init({
    id_produto: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    descricao: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    preco: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    estoque: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    imagem: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    destaque: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    ativo: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    id_marca: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    id_categoria: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    criado_em: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Produto',
    tableName: 'produto',
    timestamps: false
});
