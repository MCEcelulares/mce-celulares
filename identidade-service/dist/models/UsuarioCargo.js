"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuarioCargo = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class UsuarioCargo extends sequelize_1.Model {
}
exports.UsuarioCargo = UsuarioCargo;
UsuarioCargo.init({
    id_usuario: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
    },
    id_cargo: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
    }
}, {
    sequelize: database_1.sequelize,
    modelName: "UsuarioCargo",
    tableName: "usuario_cargo",
    timestamps: false,
});
