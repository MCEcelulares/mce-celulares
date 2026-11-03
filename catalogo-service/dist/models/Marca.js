"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Marca = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Marca extends sequelize_1.Model {
}
exports.Marca = Marca;
Marca.init({
    id_marca: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    ativo: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Marca',
    tableName: 'marca',
    timestamps: false
});
