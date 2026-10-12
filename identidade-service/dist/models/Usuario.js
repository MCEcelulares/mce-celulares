"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Usuario = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Usuario extends sequelize_1.Model {
}
exports.Usuario = Usuario;
Usuario.init({
    id_usuario: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    senha: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    cpf: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    telefone: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    ativo: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    admin: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    provedor: { type: sequelize_1.DataTypes.STRING(20), defaultValue: "local" },
    googleId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: "google_id",
    },
    email_verificado: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize: database_1.sequelize, modelName: "Usuario", tableName: "usuario", timestamps: false });
