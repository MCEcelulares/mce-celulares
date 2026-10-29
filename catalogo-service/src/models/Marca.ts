import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface MarcaAttributes {
  id_marca: number;
  nome: string;
  ativo: boolean;
}

type MarcaCreationAttributes = Optional<MarcaAttributes, 'id_marca' | 'ativo'>;

export class Marca extends Model<MarcaAttributes, MarcaCreationAttributes> implements MarcaAttributes {
  declare id_marca: number;
  declare nome: string;
  declare ativo: boolean;
}

Marca.init(
  {
    id_marca: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    nome: { 
      type: DataTypes.STRING(100), 
      allowNull: false, 
      unique: true 
    },
    ativo: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: true 
    },
  },
  { 
    sequelize, 
    modelName: 'Marca', 
    tableName: 'marca', 
    timestamps: false 
  }
);
