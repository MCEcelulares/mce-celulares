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
    id_categoria: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    icone: { type: DataTypes.STRING(255), allowNull: true },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'Categoria', tableName: 'categoria', timestamps: false }
);
