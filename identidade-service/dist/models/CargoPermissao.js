"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoPermissao = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class CargoPermissao extends sequelize_1.Model {
}
exports.CargoPermissao = CargoPermissao;
CargoPermissao.init({
    id_cargo: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
    },
    id_permissao: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
    }
}, {
    sequelize: database_1.sequelize,
    modelName: "CargoPermissao",
    tableName: "cargo_permissao",
    timestamps: false,
});
