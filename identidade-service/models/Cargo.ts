import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../src/config/database";

interface CargoAttributes {
  id_cargo: number;
  nome: string;
}

type CargoCreationAttributes = Optional<CargoAttributes, "id_cargo">;

export class Cargo
  extends Model<CargoAttributes, CargoCreationAttributes>
  implements CargoAttributes
{
  declare id_cargo: number;
  declare nome: string;
}

Cargo.init(
  {
    id_cargo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: "Cargo",
    tableName: "cargo",
    timestamps: false,
  },
);
