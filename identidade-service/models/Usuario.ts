import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../src/config/database";
import { Cargo } from "./Cargo";

interface UsuarioAttributes {
    id_usuario: number;
    nome: string;
    email: string;
    senha?: string | null;
    cpf?: string | null;
    telefone?: string | null;
    ativo: boolean;
    admin: boolean;
    provedor: string;
    googleId?: string | null;
    email_verificado: boolean;
}

type UsuarioCreationAttributes = Optional<UsuarioAttributes, "id_usuario" | "senha" | "cpf" | "telefone" | "ativo" | "admin" | "provedor" | "googleId" | "email_verificado">;

export class Usuario extends Model<UsuarioAttributes, UsuarioCreationAttributes> implements UsuarioAttributes {
    declare id_usuario: number;
    declare nome: string;
    declare email: string;
    declare senha: string | null;
    declare cpf: string | null;
    declare telefone: string | null;
    declare ativo: boolean;
    declare admin: boolean;
    declare provedor: string;
    declare googleId: string | null;
    declare email_verificado: boolean;


    declare addCargo: BelongsToManyAddAssociationMixin<Cargo, number>;
}

Usuario.init(
    {
        id_usuario: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        senha: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        cpf: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        telefone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        ativo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        provedor: {
            type: DataTypes.STRING,
            defaultValue: "local",
        },
        googleId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: false
        },
        email_verificado: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: "Usuario",
        tableName: "usuario",
        timestamps: false,
    }
)