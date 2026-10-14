import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface EnderecoAttributes {
  id_endereco: number;
  id_usuario: number;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro?: string | null;
  cidade: string;
  estado: string;
  cep: string;
  principal: boolean;
}

type EnderecoCreationAttributes = Optional<
  EnderecoAttributes,
  "id_endereco" | "complemento" | "bairro" | "principal"
>;

export class Endereco
  extends Model<EnderecoAttributes, EnderecoCreationAttributes>
  implements EnderecoAttributes
{
  declare id_endereco: number;
  declare id_usuario: number;
  declare endereco: string;
  declare numero: string;
  declare complemento: string | null;
  declare bairro: string | null;
  declare cidade: string;
  declare estado: string;
  declare cep: string;
  declare principal: boolean;
}

Endereco.init(
  {
    id_endereco: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    endereco: {
        type: DataTypes.STRING,
        allowNull: false 
    },
    numero: {
        type: DataTypes.STRING,
        allowNull: false 
    },
    complemento: { 
        type: DataTypes.STRING,
        allowNull: true 
    },
    bairro: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    cidade: { 
        type: DataTypes.STRING,
        allowNull: false 
    },
    estado: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    cep: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    principal: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
  },
  {
    sequelize,
    modelName: "Endereco",
    tableName: "endereco",
    timestamps: false,
  },
);
