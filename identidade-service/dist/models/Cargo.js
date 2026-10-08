"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cargo = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Cargo extends sequelize_1.Model {
}
exports.Cargo = Cargo;
Cargo.init({
    id_cargo: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, {
    sequelize: database_1.sequelize,
    modelName: "Cargo",
    tableName: "cargo",
    timestamps: false,
});
