import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface PermissaoAttributes {
    id_permissao: number;
    nome: string;
}

type PermissaoCreationAttributes = Optional<PermissaoAttributes, "id_permissao">;

export class Permissao extends Model<PermissaoAttributes, PermissaoCreationAttributes> implements PermissaoAttributes {
    declare id_permissao: number;
    declare nome: string;
}

Permissao.init(
    {
        id_permissao: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        }
    },
    {
        sequelize,
        modelName: "Permissao",
        tableName: "permissao",
        timestamps: false,
    },
);