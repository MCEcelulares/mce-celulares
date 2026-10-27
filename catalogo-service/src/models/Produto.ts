import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ProdutoAttributes {
  id_produto: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  estoque: number;
  imagem?: string | null;
  destaque: boolean;
  ativo: boolean;
  peso?: number | null;
  altura?: number | null;
  largura?: number | null;
  comprimento?: number | null;
  id_marca: number;
  id_categoria: number;
  criado_em: Date;
}

type ProdutoCreationAttributes = Optional<
  ProdutoAttributes,
  | 'id_produto'
  | 'descricao'
  | 'estoque'
  | 'imagem'
  | 'destaque'
  | 'ativo'
  | 'peso'
  | 'altura'
  | 'largura'
  | 'comprimento'
  | 'criado_em'
>;

export class Produto
  extends Model<ProdutoAttributes, ProdutoCreationAttributes>
  implements ProdutoAttributes
{
  declare id_produto: number;
  declare nome: string;
  declare descricao: string | null;
  declare preco: number;
  declare estoque: number;
  declare imagem: string | null;
  declare destaque: boolean;
  declare ativo: boolean;
  declare peso: number | null;
  declare altura: number | null;
  declare largura: number | null;
  declare comprimento: number | null;
  declare id_marca: number;
  declare id_categoria: number;
  declare criado_em: Date;
}

Produto.init(
  {
    id_produto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estoque: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    imagem: { type: DataTypes.STRING(255), allowNull: true },
    destaque: { type: DataTypes.BOOLEAN, defaultValue: false },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    peso: { type: DataTypes.DECIMAL(6, 3), allowNull: true },
    altura: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    largura: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    comprimento: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    id_marca: { type: DataTypes.INTEGER, allowNull: false },
    id_categoria: { type: DataTypes.INTEGER, allowNull: false },
    criado_em: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'Produto', tableName: 'produto', timestamps: false }
);
