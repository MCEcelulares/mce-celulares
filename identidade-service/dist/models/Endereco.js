"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Endereco = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Endereco extends sequelize_1.Model {
}
exports.Endereco = Endereco;
Endereco.init({
    id_endereco: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_usuario: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    endereco: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    numero: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    complemento: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    bairro: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    cidade: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    estado: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    cep: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    principal: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    sequelize: database_1.sequelize,
    modelName: "Endereco",
    tableName: "endereco",
    timestamps: false,
});
