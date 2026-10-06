import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../src/config/database";

interface CargoPermissaoAttributes {
    id_cargo: number;
    id_permissao: number;
}

export class CargoPermissao extends Model<CargoPermissaoAttributes> implements CargoPermissaoAttributes {
    declare id_cargo: number;
    declare id_permissao: number;
}

CargoPermissao.init(
    {
        id_cargo: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        id_permissao: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        }
    },
    {
        sequelize,
        modelName: "CargoPermissao",
        tableName: "cargo_permissao",
        timestamps: false,
    }
);