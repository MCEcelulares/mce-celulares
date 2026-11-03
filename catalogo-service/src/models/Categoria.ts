import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CategoriaAttributes {
  id_categoria: number;
  nome: string;
  icone?: string | null;
  ativo: boolean;
}

type CategoriaCreationAttributes = Optional<CategoriaAttributes, 'id_categoria' | 'icone' | 'ativo'>;

export class Categoria
  extends Model<CategoriaAttributes, CategoriaCreationAttributes>
  implements CategoriaAttributes
{
  declare id_categoria: number;
  declare nome: string;
  declare icone: string | null;
  declare ativo: boolean;
}

Categoria.init(
  {
    id_categoria: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    nome: { 
      type: DataTypes.STRING(100), 
      allowNull: false, 
      unique: true 
    },
    icone: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    ativo: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: true 
    },
  },
  { 
    sequelize, 
    modelName: 'Categoria', 
    tableName: 'categoria', 
    timestamps: false 
  }
);
