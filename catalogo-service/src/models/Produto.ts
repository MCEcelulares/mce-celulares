import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { Marca } from './Marca';
import type { Categoria } from './Categoria';

interface ProdutoAttributes {
  id_produto: number;
  nome: string;
  descricao?: string | null;
  preco: number | string;
  estoque: number;
  imagem?: string | null;
  destaque: boolean;
  ativo: boolean;
  id_marca: number;
  id_categoria: number;
  criado_em: Date;
}

type ProdutoCreationAttributes = Optional<
  ProdutoAttributes,
  'id_produto' | 'descricao' | 'estoque' | 'imagem' | 'destaque' | 'ativo' | 'criado_em'
>;

export class Produto extends Model<ProdutoAttributes, ProdutoCreationAttributes> implements ProdutoAttributes {
  declare id_produto: number;
  declare nome: string;
  declare descricao: string | null;
  declare preco: number | string;
  declare estoque: number;
  declare imagem: string | null;
  declare destaque: boolean;
  declare ativo: boolean;
  declare id_marca: number;
  declare id_categoria: number;
  declare criado_em: Date;

  declare marca?: Marca;
  declare categoria?: Categoria;
}

Produto.init(
  {
    id_produto: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    nome: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    descricao: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    preco: {  
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false 
    },
    estoque: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 0 
    },
    imagem: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    destaque: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false 
    },
    ativo: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: true 
    },
    id_marca: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    id_categoria: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    criado_em: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW 
    },
  },
  { 
    sequelize, 
    modelName: 'Produto', 
    tableName: 'produto', 
    timestamps: false 
  }
);
