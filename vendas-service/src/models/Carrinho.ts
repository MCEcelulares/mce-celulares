import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { ItemCarrinho } from './ItemCarrinho';

interface CarrinhoAttributes {
  id_carrinho: number;
  id_usuario: number;
  data_criacao: Date;
  ativo: boolean;
}

type CarrinhoCreationAttributes = Optional<CarrinhoAttributes, 'id_carrinho' | 'data_criacao' | 'ativo'>;

export class Carrinho
  extends Model<CarrinhoAttributes, CarrinhoCreationAttributes>
  implements CarrinhoAttributes
{
  declare id_carrinho: number;
  declare id_usuario: number;
  declare data_criacao: Date;
  declare ativo: boolean;

  declare itens?: ItemCarrinho[];
}

Carrinho.init(
  {
    id_carrinho: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_usuario: { type: DataTypes.INTEGER, allowNull: false },
    data_criacao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'Carrinho', tableName: 'carrinho', timestamps: false }
);
