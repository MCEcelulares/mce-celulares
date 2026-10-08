"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissao = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Permissao extends sequelize_1.Model {
}
exports.Permissao = Permissao;
Permissao.init({
    id_permissao: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    }
}, {
    sequelize: database_1.sequelize,
    modelName: "Permissao",
    tableName: "permissao",
    timestamps: false,
});
