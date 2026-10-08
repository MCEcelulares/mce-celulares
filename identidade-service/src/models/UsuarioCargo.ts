import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface UsuarioCargoAttributes {
    id_usuario: number;
    id_cargo: number;
}

export class UsuarioCargo extends Model<UsuarioCargoAttributes> implements UsuarioCargoAttributes {
    declare id_usuario: number;
    declare id_cargo: number;
}

UsuarioCargo.init(
    {
        id_usuario: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        id_cargo: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        }
    },
    {
        sequelize,
        modelName: "UsuarioCargo",
        tableName: "usuario_cargo",
        timestamps: false,
    }
)