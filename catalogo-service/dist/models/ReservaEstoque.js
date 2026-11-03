"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaEstoque = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class ReservaEstoque extends sequelize_1.Model {
}
exports.ReservaEstoque = ReservaEstoque;
ReservaEstoque.init({
    id_reserva_estoque: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_pedido: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    id_produto: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    quantidade: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ATIVA'
    },
    criado_em: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
    atualizado_em: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'ReservaEstoque',
    tableName: 'reserva_estoque',
    timestamps: false
});
