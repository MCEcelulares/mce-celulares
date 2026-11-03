"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Categoria = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Categoria extends sequelize_1.Model {
}
exports.Categoria = Categoria;
Categoria.init({
    id_categoria: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    icone: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    ativo: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Categoria',
    tableName: 'categoria',
    timestamps: false
});
